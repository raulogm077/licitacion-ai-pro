
import { supabase } from "../config/supabase";
import { LicitacionContent } from "../types";
import { LicitacionContentSchema } from "../lib/schemas";
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
        onProgress?: (processed: number, total: number, message: string) => void,
        onPartialSave?: (partialData: Partial<LicitacionContent>) => Promise<void>
    ): Promise<LicitacionContent> {
        const sections: { key: keyof LicitacionContent; label: string }[] = [
            { key: 'datosGenerales', label: 'Datos Generales' },
            { key: 'criteriosAdjudicacion', label: 'Criterios de Adjudicación' },
            { key: 'requisitosSolvencia', label: 'Requisitos de Solvencia' },
            { key: 'requisitosTecnicos', label: 'Requisitos Técnicos' },
            { key: 'restriccionesYRiesgos', label: 'Restricciones y Riesgos' },
            { key: 'modeloServicio', label: 'Modelo de Servicio' }
        ];

        // Initialize with basic metadata structure
        // Note: LicitacionContent does NOT have metadata. We build the content here.
        let partialResult: Partial<LicitacionContent> = {
        };
        const total = sections.length;
        let processed = 0;

        try {
            if (onProgress) onProgress(0, total, `Iniciando análisis secuencial robusto...`);

            // Sequential processing to respect strict rate limits (RPM)
            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];

                if (onProgress) {
                    onProgress(processed, total, `Analizando: ${section.label}...`);
                }

                try {
                    const sectionData = await this.analyzeSection(base64Content, section.key);
                    partialResult = { ...partialResult, ...sectionData };
                } catch (error) {
                    logger.error(`Error persistente en sección ${section.key}`, { error: String(error) });
                    const key = section.key as keyof LicitacionContent;
                    partialResult = { ...partialResult, [key]: this.getDefaultSection(key) };

                    if (onProgress) {
                        onProgress(processed, total, `⚠️ Error en ${section.label}, usando valores por defecto.`);
                    }
                }

                processed++;
                if (onProgress) {
                    onProgress(processed, total, `Sección completada: ${section.label}`);
                }

                // RF-AI-09: Incremental Persistence
                if (onPartialSave && Object.keys(partialResult).length > 0) {
                    try {
                        await onPartialSave(partialResult);
                    } catch (e) {
                        console.warn("Error saving partial progress", e);
                    }
                }

                // Wait between requests to stay under RPM limits (Gemini Pro Free tier is 2 RPM)
                if (i < sections.length - 1) {
                    const waitTime = 10000; // 10 seconds between requests for Pro stability
                    if (onProgress) onProgress(processed, total, `Esperando cuota de IA (${waitTime / 1000}s)...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }

            // Fallback for missing critical sections
            if (!partialResult.datosGenerales) partialResult.datosGenerales = this.getDefaultSection('datosGenerales');
            if (!partialResult.criteriosAdjudicacion) partialResult.criteriosAdjudicacion = this.getDefaultSection('criteriosAdjudicacion');

            const finalResult = partialResult as LicitacionContent;
            logger.info("Análisis completado", { keys: Object.keys(finalResult) });

            return finalResult;

        } catch (error) {
            logger.error("Error crítico en análisis", { error: String(error) });
            throw new LicitacionAIError(`Fallo en el proceso de análisis: ${error instanceof Error ? error.message : String(error)}`, error);
        }
    }

    private async analyzeSection<K extends keyof LicitacionContent>(base64Content: string, sectionKey: K): Promise<Partial<LicitacionContent>> {
        const plugin = promptRegistry.getActivePlugin();
        const systemPrompt = plugin.getSystemPrompt();
        const sectionPrompt = plugin.getSectionPrompt(sectionKey);
        const fullPrompt = `${sectionPrompt}\n\nResponde únicamente con un objeto JSON válido que siga la estructura para la clave "${sectionKey}".`;

        const MAX_RETRIES = 3;
        let lastError: any;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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
                    // Supabase functions error might be a string or object
                    const errObj = error.message ? error : { message: String(error) };

                    // Specific handling for 429
                    if (errObj.message.includes("429") || errObj.message.includes("Quota")) {
                        throw new Error(`CUOTA_IA_EXCEDIDA: ${errObj.message}`);
                    }

                    throw new Error(`Edge Function Error: ${errObj.message || JSON.stringify(error)}`);
                }

                if (!data || !data.text) {
                    throw new Error("Respuesta de Edge Function vacía.");
                }

                return this.cleanAndParseJson(data.text, sectionKey);

            } catch (e: any) {
                lastError = e;
                const isLastAttempt = attempt === MAX_RETRIES;
                const isQuotaError = e.message?.includes("CUOTA_IA_EXCEDIDA");

                if (!isLastAttempt) {
                    // Double delay if it's a quota error
                    const baseDelay = isQuotaError ? 20000 : 5000;
                    const delay = Math.pow(2, attempt - 1) * baseDelay;

                    console.warn(`Intento ${attempt}/${MAX_RETRIES} fallido para ${sectionKey}. Reintentando en ${delay}ms...`, e.message);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error(`Todos los intentos fallaron para ${sectionKey}:`, e);
                }
            }
        }

        throw new LicitacionAIError(`Fallo persistente backend sección ${sectionKey} tras ${MAX_RETRIES} intentos: ${lastError?.message || String(lastError)}`, lastError);
    }

    private cleanAndParseJson<K extends keyof LicitacionContent>(text: string, sectionKey: K): Partial<LicitacionContent> {
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
                    return { [sectionKey]: this.getDefaultSection(sectionKey) } as Partial<LicitacionContent>;
                }
            } else {
                return { [sectionKey]: this.getDefaultSection(sectionKey) } as Partial<LicitacionContent>;
            }
        }

        // ... (auto-unwrap logic needs minimal adjustment if strict)
        // AUTO-UNWRAP: If the AI returned { "datosGenerales": { ... } } instead of { ... }
        if (parsedJson && typeof parsedJson === 'object' && (parsedJson as Record<string, unknown>)[sectionKey]) {
            parsedJson = (parsedJson as Record<string, unknown>)[sectionKey];
        }

        // Validate against Zod schema
        try {
            const schema = LicitacionContentSchema.shape[sectionKey as keyof typeof LicitacionContentSchema.shape];
            if (!schema) {
                console.error(`Schema not found for section: ${sectionKey}`);
                return { [sectionKey]: this.getDefaultSection(sectionKey) } as Partial<LicitacionContent>;
            }
            // Use safeParse for validation
            const validationResult = schema.safeParse(parsedJson);

            if (validationResult.success) {
                // Return WRAPPED result
                return { [sectionKey]: validationResult.data } as Partial<LicitacionContent>;
            } else {
                console.warn(`Zod validation failed for section ${sectionKey}:`, validationResult.error.errors);
                logger.warn(`Zod validation failed for section ${sectionKey}`, { errors: validationResult.error.errors, data: parsedJson });
                return { [sectionKey]: this.getDefaultSection(sectionKey) } as Partial<LicitacionContent>;
            }
        } catch (error) {
            console.error(`Error during Zod validation or default section generation for ${sectionKey}:`, error);
            return { [sectionKey]: this.getDefaultSection(sectionKey) } as Partial<LicitacionContent>;
        }
    }

    private getDefaultSection<K extends keyof LicitacionContent>(sectionKey: K): LicitacionContent[K] {
        // Return UNWRAPPED default values force casted to satisfy generic return type
        switch (sectionKey) {
            case 'datosGenerales':
                return { titulo: "No detectado", presupuesto: 0, moneda: "EUR", plazoEjecucionMeses: 0, cpv: [], organoContratacion: "Desconocido" } as unknown as LicitacionContent[K];
            case 'criteriosAdjudicacion':
                return { subjetivos: [], objetivos: [] } as unknown as LicitacionContent[K];
            case 'requisitosTecnicos':
                return { funcionales: [], normativa: [] } as unknown as LicitacionContent[K];
            case 'requisitosSolvencia':
                return { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [] } as unknown as LicitacionContent[K];
            case 'restriccionesYRiesgos':
                return { killCriteria: [], riesgos: [], penalizaciones: [] } as unknown as LicitacionContent[K];
            case 'modeloServicio':
                return { sla: [], equipoMinimo: [] } as unknown as LicitacionContent[K];
            default:
                return {} as unknown as LicitacionContent[K];
        }
    }
}
