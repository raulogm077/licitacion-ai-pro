import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { LicitacionContent } from '../types';
import { LicitacionContentSchema } from '../lib/schemas';
import type { ExtractionTemplate } from '../types';
import { logger } from './logger';

export interface JobStatus {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    message?: string;
    step?: string;
    result?: LicitacionContent;
    error?: string;
}

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function readWithTimeout(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    timeoutMs: number
): Promise<ReadableStreamReadResult<Uint8Array>> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reader.cancel('Inactivity timeout');
            reject(new Error('Tiempo de espera agotado: no se recibieron datos del servidor en 5 minutos.'));
        }, timeoutMs);

        reader.read().then(
            (result) => {
                clearTimeout(timer);
                resolve(result);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            }
        );
    });
}

export class JobService {
    /**
     * Analyze documents using the phased pipeline.
     * Consumes SSE stream with phase progress events.
     */
    async analyzeWithAgents(
        pdfBase64: string,
        filename: string,
        template: ExtractionTemplate | null = null,
        onProgress?: (event: StreamEvent) => void,
        files?: { name: string; base64: string }[],
        signal?: AbortSignal
    ): Promise<{ content: LicitacionContent; workflow: unknown }> {
        let {
            data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
            throw new Error('Usuario no autenticado');
        }

        // Refresh token proactively if it expires within 60 seconds
        const now = Math.floor(Date.now() / 1000);
        if ((session.expires_at ?? 0) - now < 60) {
            logger.debug('[JobService] Token próximo a expirar, refrescando sesión...');
            const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
            if (refreshErr || !refreshed.session) {
                throw new Error('Sesión expirada. Por favor, inicia sesión de nuevo.');
            }
            session = refreshed.session;
            logger.debug('[JobService] Sesión refrescada con éxito.');
        }

        try {
            logger.debug('[JobService] Starting phased analysis...');

            const projectUrl = env.VITE_SUPABASE_URL;
            const functionUrl = `${projectUrl}/functions/v1/analyze-with-agents`;

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token}`,
                    apikey: env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    pdfBase64,
                    filename,
                    template,
                    files,
                }),
                signal,
            });

            if (!response.ok) {
                let serverMessage = '';
                try {
                    const errorBody = await response.json();
                    serverMessage = errorBody.error || errorBody.message || '';
                } catch {
                    /* ignore parse error */
                }
                throw new Error(serverMessage || `Error del servidor (HTTP ${response.status})`);
            }

            if (!response.body) {
                throw new Error('No response body');
            }

            // Read SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finalResult: { result?: unknown; workflow?: unknown } | null = null;

            let reading = true;
            let streamError: Error | null = null;

            while (reading) {
                const { done, value } = await readWithTimeout(reader, INACTIVITY_TIMEOUT_MS);

                if (done) {
                    reading = false;
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;

                    let event: StreamEvent;
                    try {
                        event = JSON.parse(line.slice(6));
                    } catch {
                        logger.warn('[JobService] Failed to parse SSE event:', line);
                        continue;
                    }

                    if (onProgress) {
                        onProgress(event);
                    }

                    if (event.type === 'complete') {
                        // Pipeline sends { result, workflow } spread into the event
                        finalResult = {
                            result: event.result,
                            workflow: event.workflow,
                        };
                    }

                    if (event.type === 'error') {
                        streamError = new Error(event.message || 'Error en streaming');
                        reading = false;
                        break;
                    }
                }

                if (streamError) break;
            }

            // Release the reader lock
            try {
                reader.releaseLock();
            } catch {
                /* already released */
            }

            if (streamError) throw streamError;
            if (!finalResult) throw new Error('No se recibió resultado final del stream');

            logger.debug('[JobService] Result received, validating...');

            // The new pipeline returns { result, workflow } directly — no transformation needed
            const resultData = finalResult.result || finalResult;
            const validated = LicitacionContentSchema.parse(resultData);

            logger.info('[JobService] Analysis completed and validated');

            return {
                content: validated,
                workflow: finalResult.workflow,
            };
        } catch (error: unknown) {
            logger.error('[JobService] Error en análisis:', error);
            throw error;
        }
    }
}

// SSE event types
export interface StreamEvent {
    type:
        | 'heartbeat'
        | 'phase_started'
        | 'phase_completed'
        | 'phase_progress'
        | 'extraction_progress'
        | 'complete'
        | 'error'
        // Legacy event types (backward compat)
        | 'agent_message';
    phase?: string;
    content?: string | unknown;
    result?: unknown;
    workflow?: unknown;
    message?: string;
    timestamp: number;
    blockIndex?: number;
    totalBlocks?: number;
}

export const jobService = new JobService();
