
import { LicitacionContent } from "../types";
import { logger } from "./logger";
import { promptRegistry } from "../config/prompt-registry";
import { llmFactory } from "../llm/llmFactory";
import { LLMProviderError, LLMErrorCode } from "../llm/errors";
import type { JobStatus } from "./job.service";

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
        onPartialSave?: (partialData: Partial<LicitacionContent>) => Promise<void>,
        signal?: AbortSignal,
        providerName?: string,
        filename?: string, // NEW: Required for OpenAI
        hash?: string     // NEW: Required for OpenAI
    ): Promise<LicitacionContent> {
        // OpenAI Specific Route (Server-Side)
        if (providerName === 'openai') {
            try {
                if (!filename || !hash) {
                    throw new LicitacionAIError("Filename and Hash are required for OpenAI analysis");
                }

                // Import dynamically to avoid circular dependency issues if any (though jobService is safe)
                const { jobService } = await import('./job.service');

                if (onProgress) onProgress(0, 100, "Iniciando análisis con AI Agents (Streaming)...");

                // Check for cancellation before starting
                if (signal?.aborted) {
                    throw new LicitacionAIError('Análisis cancelado por el usuario');
                }

                let processedEvents = 0;

                // Call the new streaming architecture
                const result = await jobService.analyzeWithAgents(
                    base64Content,
                    null, // No guide PDF needed currently
                    filename,
                    (event) => {
                        if (signal?.aborted) {
                            // If aborted during stream, we can't easily kill the edge function
                            // from here without a separate endpoint, but we can stop processing
                            throw new LicitacionAIError('Análisis cancelado durante procesamiento');
                        }

                        processedEvents++;
                        if (onProgress) {
                            // Fake progress up to 95%, based on events received
                            const estimatedTotal = 50; // Arbitrary expected event count
                            const rawProgress = Math.min((processedEvents / estimatedTotal) * 95, 95);

                            if (event.type === 'agent_message' && typeof event.content === 'string') {
                                onProgress(rawProgress, 100, `[Agent] ${event.content.substring(0, 60)}...`);
                            } else if (event.type === 'heartbeat') {
                                // Just a keep-alive
                                onProgress(rawProgress, 100, "Procesando documento...");
                            }
                        }
                    }
                );

                if (onProgress) onProgress(100, 100, "✅ Resultado validado recibido del servidor");
                return result;

            } catch (err: unknown) {
                // Convert Job errors to LicitacionAIError
                const errorMessage = err instanceof Error ? err.message : "Error en OpenAIService";
                throw new LicitacionAIError(errorMessage, err);
            }
        }

        // Gemini Route (Client-Side Sequential)
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
            // Check if already aborted before starting
            if (signal?.aborted) {
                throw new LicitacionAIError('Análisis cancelado por el usuario');
            }

            if (onProgress) onProgress(0, total, `Iniciando análisis secuencial robusto...`);

            // Sequential processing to respect strict rate limits (RPM)
            for (let i = 0; i < sections.length; i++) {
                // Check for cancellation before processing each section
                if (signal?.aborted) {
                    throw new LicitacionAIError('Análisis cancelado durante procesamiento');
                }

                const section = sections[i];

                if (onProgress) {
                    onProgress(processed, total, `Analizando: ${section.label}...`);
                }

                try {
                    const sectionData = await this.analyzeSection(base64Content, section.key, signal, providerName);
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

    private async analyzeSection<K extends keyof LicitacionContent>(
        base64Content: string,
        sectionKey: K,
        signal?: AbortSignal,
        providerName?: string
    ): Promise<Partial<LicitacionContent>> {
        const plugin = promptRegistry.getActivePlugin();
        const systemPrompt = plugin.getSystemPrompt();
        const sectionPrompt = plugin.getSectionPrompt(sectionKey);

        // Get the LLM provider (default to gemini if not specified)
        const provider = llmFactory.getProvider((providerName || 'gemini') as 'gemini' | 'openai');

        try {
            const result = await provider.analyzeSection({
                base64Content,
                systemPrompt,
                sectionPrompt,
                sectionKey,
                signal,
                maxRetries: 3
            });

            // Return wrapped result (provider returns just the data for that section)
            return { [sectionKey]: result.data } as Partial<LicitacionContent>;

        } catch (error) {
            if (error instanceof LLMProviderError) {
                // Convert LLMProviderError to LicitacionAIError for backward compatibility
                if (error.code === LLMErrorCode.USER_CANCELLED) {
                    throw new LicitacionAIError('Análisis cancelado por el usuario', error);
                }

                if (error.code === LLMErrorCode.API_QUOTA_EXCEEDED) {
                    throw new LicitacionAIError(`CUOTA_IA_EXCEDIDA: ${error.hint || error.message}`, error);
                }

                throw new LicitacionAIError(
                    `Fallo persistente backend sección ${sectionKey}: ${error.message}`,
                    error
                );
            }

            throw error;
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
