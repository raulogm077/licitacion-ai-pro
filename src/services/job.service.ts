import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { LicitacionContent } from '../types';
import { LicitacionContentSchema } from '../lib/schemas';
import type { ExtractionTemplate } from '../types';
import { logger } from './logger';

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

        // Refresh token proactively if it expires within 5 minutes (was 60s — too tight)
        const now = Math.floor(Date.now() / 1000);
        if ((session.expires_at ?? 0) - now < 300) {
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

            const buildHeaders = (token: string) => ({
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                apikey: env.VITE_SUPABASE_ANON_KEY,
            });

            const body = JSON.stringify({ pdfBase64, filename, template, files });

            let response = await fetch(functionUrl, {
                method: 'POST',
                headers: buildHeaders(session.access_token),
                body,
                signal,
            });

            // On 401, force a session refresh and retry once before giving up
            if (response.status === 401) {
                logger.warn('[JobService] 401 from Edge Function — forcing session refresh and retrying...');
                const { data: retrySession, error: retryErr } = await supabase.auth.refreshSession();
                if (retryErr || !retrySession.session) {
                    throw new Error('Sesión expirada. Por favor, inicia sesión de nuevo.');
                }
                session = retrySession.session;
                response = await fetch(functionUrl, {
                    method: 'POST',
                    headers: buildHeaders(session.access_token),
                    body,
                    signal,
                });
            }

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
            const state = {
                finalResult: null as { result: unknown; workflow?: unknown } | null,
                reading: true,
                streamError: null as Error | null,
            };

            const processLine = (line: string) => {
                if (!line.trim() || !line.startsWith('data: ')) return;

                let event: StreamEvent;
                try {
                    event = JSON.parse(line.slice(6));
                } catch {
                    logger.warn('[JobService] Failed to parse SSE event:', line);
                    return;
                }

                if (onProgress) {
                    try {
                        onProgress(event);
                    } catch (err) {
                        logger.error('[JobService] onProgress callback error:', err);
                    }
                }

                if (event.type === 'complete') {
                    if (!event.result) {
                        state.streamError = new Error('Error del servidor: evento "complete" sin resultado');
                        state.reading = false;
                        return;
                    }
                    state.finalResult = {
                        result: event.result,
                        workflow: event.workflow,
                    };
                    state.reading = false;
                }

                if (event.type === 'error') {
                    state.streamError = new Error(event.message || 'Error en streaming');
                    state.reading = false;
                }
            };

            while (state.reading) {
                const { done, value } = await readWithTimeout(reader, INACTIVITY_TIMEOUT_MS);

                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    processLine(line);
                    if (!state.reading) break;
                }
            }

            // Process any remaining data in buffer after stream ends
            if (buffer.trim()) {
                processLine(buffer);
            }

            // Release the reader lock
            try {
                reader.releaseLock();
            } catch {
                /* already released */
            }

            if (state.streamError) throw state.streamError;
            if (!state.finalResult) throw new Error('No se recibió resultado final del stream');

            logger.debug('[JobService] Result received, validating...');

            const resultData = state.finalResult.result;
            const parseResult = LicitacionContentSchema.safeParse(resultData);
            let validated: LicitacionContent;
            if (!parseResult.success) {
                console.warn('[JobService] Schema validation warning:', parseResult.error.message.substring(0, 300));
                // Use raw data as fallback to preserve results even if schema is slightly mismatched
                validated = resultData as LicitacionContent;
            } else {
                validated = parseResult.data;
            }

            logger.info('[JobService] Analysis completed and validated');

            return {
                content: validated,
                workflow: state.finalResult.workflow,
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
        | 'retry_scheduled'
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
    blockName?: string;
    attempt?: number;
    maxAttempts?: number;
    waitMs?: number;
    reason?: string;
}

export const jobService = new JobService();
