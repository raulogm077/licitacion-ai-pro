
import { LicitacionContent } from "../types";
import { logger } from "./logger";
import { promptRegistry } from "../config/prompt-registry";
import { llmFactory } from "../llm/llmFactory";
import { LLMProviderError, LLMErrorCode } from "../llm/errors";


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

                if (onProgress) onProgress(0, 100, "Conectando al servidor OpenAI (Streaming)...");

                // We get the Supabase variables dynamically to use them
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

                // Call the Edge Function directly using fetch to get the SSE stream
                const response = await fetch(`${supabaseUrl}/functions/v1/analyze-with-agents`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseAnonKey}`
                    },
                    body: JSON.stringify({
                        pdfBase64: base64Content,
                        filename: filename,
                        guiaBase64: null // Guia might be read locally or omitted here as it may be pre-indexed
                    }),
                    signal
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Edge Function returned ${response.status}: ${errorText}`);
                }

                if (!response.body) {
                    throw new Error("Respuesta del servidor sin cuerpo de datos");
                }

                if (onProgress) onProgress(10, 100, "Analizando el pliego...");

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullResult = null;
                let done = false;
                let textBuffer = '';

                // Read SSE stream
                while (!done) {
                    if (signal?.aborted) {
                        reader.cancel();
                        throw new LicitacionAIError('Análisis cancelado por el usuario');
                    }

                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;

                    if (value) {
                        textBuffer += decoder.decode(value, { stream: true });
                        const lines = textBuffer.split('');
                        textBuffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const dataStr = line.substring(6);
                                if (dataStr === '[DONE]') continue;

                                try {
                                    const event = JSON.parse(dataStr);

                                    if (event.type === 'heartbeat') {
                                        continue;
                                    }

                                    if (event.type === 'agent_message') {
                                        // Update progress text dynamically
                                        if (onProgress) onProgress(50, 100, `[Analizando]: ${event.content ? String(event.content).substring(0, 50) + '...' : 'Procesando...'}`);
                                    }

                                    if (event.type === 'complete' && event.result) {
                                        fullResult = typeof event.result === 'string' ? JSON.parse(event.result) : event.result;
                                    }
                                } catch (_) {
                                    // Ignore parse errors for partial chunks
                                }
                            }
                        }
                    }
                }

                if (!fullResult) {
                    throw new Error("No se recibió el resultado final del análisis");
                }

                if (onProgress) onProgress(100, 100, "✅ Resultado recibido del servidor");

                // Unpack from {"result": {...}, "workflow": {...}} if present
                if (fullResult.result) {
                    return fullResult.result as LicitacionContent;
                }

                return fullResult as LicitacionContent;

            } catch (err: unknown) {
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
                    } catch (_) {
                        console.warn("Error saving partial progress", _);
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
