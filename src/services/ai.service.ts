
import { supabase } from "../config/supabase";
import { LicitacionData } from "../types";
import { LicitacionSchema } from "../lib/schemas";
import { logger } from "./logger";
import { promptRegistry } from "../config/prompt-registry";

export class LicitacionAIError extends Error {
    constructor(message: string, public readonly originalError?: unknown) {
        super(message);
        this.name = 'LicitacionAIError';
    }
}

export class AIService {
    constructor() {
    }

    async analyzePdfContent(
        base64Content: string,
        onProgress?: (processed: number, total: number, message: string) => void
    ): Promise<LicitacionData> {
        const sections: { key: keyof LicitacionData; label: string }[] = [
            { key: 'datosGenerales', label: 'Datos Generales' },
            { key: 'criteriosAdjudicacion', label: 'Criterios de Adjudicación' },
            { key: 'requisitosSolvencia', label: 'Requisitos de Solvencia' },
            { key: 'requisitosTecnicos', label: 'Requisitos Técnicos' },
            { key: 'restriccionesYRiesgos', label: 'Restricciones y Riesgos' },
            { key: 'modeloServicio', label: 'Modelo de Servicio' }
        ];

        // Initialize with basic metadata structure
        let partialResult: Partial<LicitacionData> = {
            metadata: {
                estado: 'PENDIENTE',
                tags: [],
                sectionStatus: {}
            }
        };
        const total = sections.length;
        let processed = 0;

        try {
            if (onProgress) onProgress(0, total, `Iniciando análisis paralelo seguro...`);

            // Process sections in chunks to balance speed and rate limits.
            // Increased to 3 for better performance.
            const chunkSize = 3;
            for (let i = 0; i < sections.length; i += chunkSize) {
                const chunk = sections.slice(i, i + chunkSize);

                if (onProgress) {
                    const labels = chunk.map(s => s.label).join(', ');
                    onProgress(processed, total, `Analizando: ${labels}...`);
                }

                const chunkPromises = chunk.map(async (section) => {
                    try {
                        const sectionData = await this.analyzeSection(base64Content, section.key);
                        return { key: section.key, data: sectionData, success: true };
                    } catch (error) {
                        logger.error(`Error en sección ${section.key}`, { error: String(error) });
                        const key = section.key as keyof LicitacionData;
                        return { key, data: { [key]: this.getDefaultSection(key) }, success: false };
                    }
                });

                const chunkResults = await Promise.all(chunkPromises);

                chunkResults.forEach(res => {
                    partialResult = { ...partialResult, ...res.data };
                    if (partialResult.metadata) {
                        partialResult.metadata.sectionStatus = {
                            ...(partialResult.metadata.sectionStatus || {}),
                            [res.key]: res.success ? 'success' : 'failed'
                        };
                    }
                    processed++;
                    if (onProgress) {
                        onProgress(processed, total, `Sección completada: ${res.key}`);
                    }
                });

                // Short throttle between chunks
                if (i + chunkSize < sections.length) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            }

            // Fallback for missing critical sections
            if (!partialResult.datosGenerales) partialResult.datosGenerales = this.getDefaultSection('datosGenerales');
            if (!partialResult.criteriosAdjudicacion) partialResult.criteriosAdjudicacion = this.getDefaultSection('criteriosAdjudicacion');

            const finalResult = partialResult as LicitacionData;
            logger.info("Análisis completado", { keys: Object.keys(finalResult) });

            return finalResult;

        } catch (error) {
            logger.error("Error crítico en análisis", { error: String(error) });
            throw new LicitacionAIError(`Fallo en el proceso de análisis: ${error instanceof Error ? error.message : String(error)}`, error);
        }
    }

    private async analyzeSection<K extends keyof LicitacionData>(base64Content: string, sectionKey: K): Promise<Partial<LicitacionData>> {
        const plugin = promptRegistry.getActivePlugin();
        const systemPrompt = plugin.getSystemPrompt();
        const sectionPrompt = plugin.getSectionPrompt(sectionKey);

        const fullPrompt = `${sectionPrompt}\n\nResponde únicamente con un objeto JSON válido que siga la estructura para la clave "${sectionKey}".`;

        try {
            const { data, error } = await supabase.functions.invoke('analyze-licitacion', {
                body: {
                    base64Content,
                    prompt: fullPrompt,
                    systemPrompt,
                    sectionKey
                }
            });

            if (error) {
                console.error("Function Error:", error);
                throw new Error(`Error invocando Edge Function: ${error.message}`);
            }

            if (!data || !data.text) {
                throw new Error("Respuesta de Edge Function vacía.");
            }

            return this.cleanAndParseJson(data.text, sectionKey);

        } catch (e) {
            console.warn(`Fallo invocando backend para ${sectionKey}:`, e);
            // This throw is caught by the chunk processor, so it's fine
            throw new LicitacionAIError(`Fallo backend sección ${sectionKey}: ${String(e)}`, e);
        }
    }

    private cleanAndParseJson<K extends keyof LicitacionData>(text: string, sectionKey: K): Partial<LicitacionData> {
        let cleanedText = text;

        // Remove Markdown code blocks (```json ... ```)
        cleanedText = cleanedText.replace(/```json\n([\s\S]*?)\n```/s, '$1');
        cleanedText = cleanedText.replace(/```([\s\S]*?)```/s, '$1'); // General markdown code block

        let parsedJson: unknown;
        try {
            parsedJson = JSON.parse(cleanedText);
        } catch (e) {
            // ... (logging)
            const likelyJson = cleanedText.match(/\{.*\}/s);
            if (likelyJson && likelyJson[0]) {
                try {
                    parsedJson = JSON.parse(likelyJson[0]);
                } catch (e2) {
                    console.warn(`Fallo de parseo JSON (fallback regex) en sección ${sectionKey}:`, e2);
                    return { [sectionKey]: this.getDefaultSection(sectionKey) } as Partial<LicitacionData>;
                }
            } else {
                return { [sectionKey]: this.getDefaultSection(sectionKey) } as Partial<LicitacionData>;
            }
        }

        // ... (auto-unwrap logic needs minimal adjustment if strict)
        // AUTO-UNWRAP: If the AI returned { "datosGenerales": { ... } } instead of { ... }
        if (parsedJson && typeof parsedJson === 'object' && (parsedJson as Record<string, unknown>)[sectionKey]) {
            parsedJson = (parsedJson as Record<string, unknown>)[sectionKey];
        }

        // Validate against Zod schema
        try {
            const schema = LicitacionSchema.shape[sectionKey as keyof typeof LicitacionSchema.shape];
            if (!schema) {
                console.error(`Schema not found for section: ${sectionKey}`);
                return { [sectionKey]: this.getDefaultSection(sectionKey) } as Partial<LicitacionData>;
            }
            // Use safeParse for validation
            const validationResult = schema.safeParse(parsedJson);

            if (validationResult.success) {
                // Return WRAPPED result
                return { [sectionKey]: validationResult.data } as Partial<LicitacionData>;
            } else {
                console.warn(`Zod validation failed for section ${sectionKey}:`, validationResult.error.errors);
                logger.warn(`Zod validation failed for section ${sectionKey}`, { errors: validationResult.error.errors, data: parsedJson });
                return { [sectionKey]: this.getDefaultSection(sectionKey) } as Partial<LicitacionData>;
            }
        } catch (error) {
            console.error(`Error during Zod validation or default section generation for ${sectionKey}:`, error);
            return { [sectionKey]: this.getDefaultSection(sectionKey) } as Partial<LicitacionData>;
        }
    }

    private getDefaultSection<K extends keyof LicitacionData>(sectionKey: K): LicitacionData[K] {
        // Return UNWRAPPED default values force casted to satisfy generic return type
        switch (sectionKey) {
            case 'datosGenerales':
                return { titulo: "No detectado", presupuesto: 0, moneda: "EUR", plazoEjecucionMeses: 0, cpv: [], organoContratacion: "Desconocido" } as unknown as LicitacionData[K];
            case 'criteriosAdjudicacion':
                return { subjetivos: [], objetivos: [] } as unknown as LicitacionData[K];
            case 'requisitosTecnicos':
                return { funcionales: [], normativa: [] } as unknown as LicitacionData[K];
            case 'requisitosSolvencia':
                return { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [] } as unknown as LicitacionData[K];
            case 'restriccionesYRiesgos':
                return { killCriteria: [], riesgos: [], penalizaciones: [] } as unknown as LicitacionData[K];
            case 'modeloServicio':
                return { sla: [], equipoMinimo: [] } as unknown as LicitacionData[K];
            default:
                return {} as unknown as LicitacionData[K];
        }
    }
}
