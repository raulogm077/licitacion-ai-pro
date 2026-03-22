
import { LicitacionContent, ExtractionTemplate } from "../types";
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

    async analyzePdfContent(
        base64Content: string,
        onProgress?: (processed: number, total: number, message: string) => void,
        _onPartialSave?: (partialData: Partial<LicitacionContent>) => Promise<void>,
        signal?: AbortSignal,
        _providerName?: string,
        filename?: string,
        hash?: string,
        template?: ExtractionTemplate | null,
        files?: { name: string, base64: string }[]
    ): Promise<LicitacionContent> {
        try {
            if (!filename || !hash) {
                throw new LicitacionAIError("Filename and Hash are required for OpenAI analysis");
            }

            const { jobService } = await import('./job.service');

            if (onProgress) onProgress(0, 100, "Iniciando análisis con AI Agents (Streaming)...");

            if (signal?.aborted) {
                throw new LicitacionAIError('Análisis cancelado por el usuario');
            }

            let processedEvents = 0;

            const result = await jobService.analyzeWithAgents(
                base64Content,
                null,
                filename,
                template || null,
                (event) => {
                    if (signal?.aborted) {
                        throw new LicitacionAIError('Análisis cancelado durante procesamiento');
                    }

                    processedEvents++;
                    if (onProgress) {
                        const estimatedTotal = 50;
                        const rawProgress = Math.min((processedEvents / estimatedTotal) * 95, 95);

                        if (event.type === 'agent_message' && typeof event.content === 'string') {
                            onProgress(rawProgress, 100, `[Agent] ${event.content.substring(0, 60)}...`);
                        } else if (event.type === 'heartbeat') {
                            onProgress(rawProgress, 100, "Procesando documento...");
                        }
                    }
                },
                files,
                signal
            );

            if (onProgress) onProgress(100, 100, "Resultado validado recibido del servidor");
            return result;

        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Error en OpenAIService";
            logger.error("Error en análisis AI:", err);
            throw new LicitacionAIError(errorMessage, err);
        }
    }
}
