
import { supabase } from "../config/supabase";
import { LicitacionData } from "../types";
import { LicitacionSchema } from "../lib/schemas";
import { logger } from "./logger";

export class LicitacionAIError extends Error {
    constructor(message: string, public readonly originalError?: unknown) {
        super(message);
        this.name = 'LicitacionAIError';
    }
}

export class AIService {
    constructor() {
    }

    async analyzePdfContent(base64Content: string, onThinking?: (text: string) => void): Promise<LicitacionData> {
        const sections = [
            { key: 'datosGenerales', label: 'Datos Generales' },
            { key: 'criteriosAdjudicacion', label: 'Criterios de Adjudicación' },
            { key: 'requisitosSolvencia', label: 'Requisitos de Solvencia' },
            { key: 'requisitosTecnicos', label: 'Requisitos Técnicos' },
            { key: 'restriccionesYRiesgos', label: 'Restricciones y Riesgos' },
            { key: 'modeloServicio', label: 'Modelo de Servicio' }
        ];

        let partialResult: Partial<LicitacionData> = {};

        try {
            if (onThinking) onThinking(`Iniciando análisis seguro(Backend)...`);

            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                if (onThinking) onThinking(`Analizando sección ${i + 1}/${sections.length} (${section.label})...`);

                logger.info(`Iniciando análisis de sección: ${section.key}`);

                try {
                    const sectionData = await this.analyzeSection(base64Content, section.key);
                    partialResult = { ...partialResult, ...sectionData };

                    // Small delay to be nice to the network, backend handles rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (sectionError) {
                    console.error(`Error analizando sección ${section.key}:`, sectionError);
                    logger.error(`Error en sección ${section.key}`, { error: String(sectionError) });
                    // Continue with other sections even if one fails
                }
            }

            // Fallback for missing critical sections
            if (!partialResult.datosGenerales) partialResult.datosGenerales = this.getDefaultSection('datosGenerales');
            if (!partialResult.criteriosAdjudicacion) partialResult.criteriosAdjudicacion = this.getDefaultSection('criteriosAdjudicacion');

            const finalResult = partialResult as LicitacionData;

            // Final validation log
            logger.info("Análisis completado", { keys: Object.keys(finalResult) });

            return finalResult;

        } catch (error) {
            logger.error("Error crítico en análisis", { error: String(error) });
            throw new LicitacionAIError(`Fallo en el proceso de análisis: ${error instanceof Error ? error.message : String(error)}`, error);
        }
    }

    private async analyzeSection(base64Content: string, sectionKey: string): Promise<Partial<LicitacionData>> {
        const prompt = `Analiza el contenido del PDF para la sección "${sectionKey}". Extrae la información requerida y devuélvela en formato JSON. Asegúrate de que la respuesta sea un JSON válido y completo.`;

        try {
            const { data, error } = await supabase.functions.invoke('analyze-licitacion', {
                body: {
                    base64Content,
                    prompt,
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
            throw new LicitacionAIError(`Fallo backend sección ${sectionKey}: ${String(e)}`, e);
        }
    }

    private cleanAndParseJson(text: string, sectionKey: string): Partial<LicitacionData> {
        let cleanedText = text;

        // Remove Markdown code blocks (```json ... ```)
        cleanedText = cleanedText.replace(/```json\n([\s\S]*?)\n```/s, '$1');
        cleanedText = cleanedText.replace(/```([\s\S]*?)```/s, '$1'); // General markdown code block

        let parsedJson: unknown;
        try {
            parsedJson = JSON.parse(cleanedText);
        } catch (e) {
            console.warn(`Fallo de parseo JSON en sección ${sectionKey}:`, e);
            logger.warn(`JSON parse error in section ${sectionKey}`, { error: String(e), rawText: cleanedText.substring(0, 100) + "..." });
            // Attempt to recover by removing potential trailing characters or malformed parts
            const likelyJson = cleanedText.match(/\{.*\}/s);
            if (likelyJson && likelyJson[0]) {
                try {
                    parsedJson = JSON.parse(likelyJson[0]);
                } catch (e2) {
                    console.warn(`Fallo de parseo JSON (fallback regex) en sección ${sectionKey}:`, e2);
                    return { [sectionKey]: this.getDefaultSection(sectionKey) };
                }
            } else {
                return { [sectionKey]: this.getDefaultSection(sectionKey) };
            }
        }

        // AUTO-UNWRAP: If the AI returned { "datosGenerales": { ... } } instead of { ... }
        if (parsedJson && typeof parsedJson === 'object' && (parsedJson as Record<string, unknown>)[sectionKey]) {
            parsedJson = (parsedJson as Record<string, unknown>)[sectionKey];
        }

        // Validate against Zod schema
        try {
            const schema = LicitacionSchema.shape[sectionKey as keyof typeof LicitacionSchema.shape];
            if (!schema) {
                console.error(`Schema not found for section: ${sectionKey}`);
                return { [sectionKey]: this.getDefaultSection(sectionKey) };
            }
            // Use safeParse for validation
            const validationResult = schema.safeParse(parsedJson);

            if (validationResult.success) {
                // Return WRAPPED result
                return { [sectionKey]: validationResult.data };
            } else {
                console.warn(`Zod validation failed for section ${sectionKey}:`, validationResult.error.errors);
                logger.warn(`Zod validation failed for section ${sectionKey}`, { errors: validationResult.error.errors, data: parsedJson });
                return { [sectionKey]: this.getDefaultSection(sectionKey) };
            }
        } catch (error) {
            console.error(`Error during Zod validation or default section generation for ${sectionKey}:`, error);
            return { [sectionKey]: this.getDefaultSection(sectionKey) };
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getDefaultSection(sectionKey: string): any {
        // Return UNWRAPPED default values
        switch (sectionKey) {
            case 'datosGenerales': return { titulo: "No detectado", presupuesto: 0, moneda: "EUR", plazoEjecucionMeses: 0, cpv: [], organoContratacion: "Desconocido" };
            case 'criteriosAdjudicacion': return { subjetivos: [], objetivos: [] };
            case 'requisitosTecnicos': return { funcionales: [], normativa: [] };
            case 'requisitosSolvencia': return { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [] };
            case 'restriccionesYRiesgos': return { killCriteria: [], riesgos: [], penalizaciones: [] };
            case 'modeloServicio': return { sla: [], equipoMinimo: [] };
            default: return {};
        }
    }
}
