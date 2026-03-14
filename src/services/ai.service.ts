
import { LicitacionContent } from "../types";

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
        _signal?: AbortSignal,
        providerName?: string,
        filename?: string, // NEW: Required for OpenAI
        hash?: string,     // NEW: Required for OpenAI
        guiaBase64?: string | null // NEW: Guía de lectura para Agentes
    ): Promise<LicitacionContent> {
        // OpenAI Specific Route (Server-Side)
        if (providerName === 'openai') {
            try {
                if (!filename || !hash) {
                    throw new LicitacionAIError("Filename and Hash are required for OpenAI analysis");
                }

                // 1. Start Job
                if (onProgress) onProgress(0, 100, "Iniciando análisis con Agentes de OpenAI...");
                // Import dynamically to avoid circular dependency issues if any (though jobService is safe)
                const { jobService } = await import('./job.service');

                // Note: analyzeWithAgents takes base64, guiaBase64, filename, onProgress
                const result = await jobService.analyzeWithAgents(
                    base64Content,
                    guiaBase64 || null,
                    filename,
                    (event) => {
                         if (onProgress && event.message) {
                            onProgress(50, 100, `[Agent] ${event.message}`);
                         } else if (onProgress && event.type === 'agent_message' && typeof event.content === 'string') {
                            onProgress(50, 100, event.content.substring(0, 100));
                         }
                    }
                );

                if (onProgress) onProgress(100, 100, "✅ Resultado recibido del agente");
                return result;

            } catch (err: unknown) {
                // Convert Job errors to LicitacionAIError
                const errorMessage = err instanceof Error ? err.message : "Error en OpenAIService";
                throw new LicitacionAIError(errorMessage, err);
            }
        }

        // Fallback or old Sequential Route handling shouldn't be executed for OpenAI,
        // but if we are here and provider is not OpenAI server route, we just throw.
        throw new LicitacionAIError("Análisis secuencial del cliente deprecado. Por favor usa OpenAI en el servidor.");
    }
}
