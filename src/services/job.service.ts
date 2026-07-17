import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { LicitacionContent } from '../types';
import { LicitacionContentSchema } from '../lib/schemas';
import type { ExtractionTemplate } from '../types';
import type { AnalysisPhase, AnalysisStreamEvent } from '../shared/analysis-contract';
import { logger } from './logger';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const RECOVERY_TIMEOUT_MS = 30 * 60 * 1000;
const RECOVERY_POLL_INTERVAL_MS = 2000;

export interface AnalysisUploadSource {
    file: File;
    sha256: string;
}

interface SignedUploadPlan {
    documentId: string;
    name: string;
    path: string;
    token: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
}

interface AnalysisJobInitResponse {
    jobId: string;
    created: boolean;
    status: string;
    uploads: SignedUploadPlan[];
}

interface DurableJobState {
    status: string;
    result: unknown;
    error?: string | null;
    phase?: string | null;
    updated_at?: string | null;
}

function createIdempotencyKey(): string {
    return globalThis.crypto?.randomUUID?.() ?? `analysis-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function waitForRecoveryPoll(signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }

        const timer = setTimeout(resolve, RECOVERY_POLL_INTERVAL_MS);
        signal?.addEventListener(
            'abort',
            () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true }
        );
    });
}

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
    private async recoverDurableResult(
        jobId: string,
        signal?: AbortSignal,
        onProgress?: (event: AnalysisStreamEvent) => void,
        accessToken?: string
    ): Promise<{ result: unknown; workflow?: unknown }> {
        const deadline = Date.now() + RECOVERY_TIMEOUT_MS;

        if (accessToken) await supabase.realtime.setAuth(accessToken);
        let wakeRecovery: (() => void) | null = null;
        const realtimeWake = () =>
            new Promise<void>((resolve) => {
                wakeRecovery = resolve;
            });

        const channel = supabase
            .channel(`analysis-job:${jobId}`, { config: { private: true } })
            .on('broadcast', { event: 'analysis_job_updated' }, (message) => {
                const payload = (message?.payload || {}) as Record<string, unknown>;
                const phase = this.toAnalysisPhase(String(payload.phase || ''));
                try {
                    onProgress?.({
                        type: 'phase_progress',
                        timestamp: Date.now(),
                        phase,
                        message: this.phaseMessage(String(payload.status || ''), String(payload.phase || '')),
                    });
                } catch (error) {
                    logger.error('[JobService] onProgress callback error:', error);
                }
                wakeRecovery?.();
                wakeRecovery = null;
            })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    logger.warn('[JobService] Realtime no disponible; continúa el polling durable', { jobId, status });
                }
            });

        try {
            while (Date.now() < deadline) {
                if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

                const { data, error } = await supabase
                    .from('analysis_jobs')
                    .select('status, result, error, phase, updated_at')
                    .eq('id', jobId)
                    .single();

                if (error) throw new Error(`No se pudo recuperar el análisis: ${error.message}`);
                const state = data as DurableJobState;

                if (state.status === 'completed' && state.result) {
                    const saved = state.result as { result?: unknown; workflow?: unknown };
                    return { result: saved.result ?? saved, workflow: saved.workflow };
                }

                if (['failed', 'cancelled', 'dead_letter'].includes(state.status)) {
                    throw new Error(state.error || 'El análisis no pudo completarse');
                }

                await Promise.race([waitForRecoveryPoll(signal), realtimeWake()]);
            }
        } finally {
            await supabase.removeChannel(channel);
        }

        throw new Error('El análisis sigue en curso. Vuelve a abrirlo desde tu historial en unos minutos.');
    }

    private toAnalysisPhase(phase: string): AnalysisPhase | undefined {
        if (phase === 'ingestion_map') return 'ingestion';
        if (['ingestion', 'document_map', 'extraction', 'consolidation', 'validation'].includes(phase)) {
            return phase as AnalysisPhase;
        }
        return undefined;
    }

    private phaseMessage(status: string, phase: string): string {
        if (status === 'retrying') return `Reintentando la fase ${phase || 'actual'}...`;
        if (status === 'queued') return `Fase ${phase || 'siguiente'} en cola...`;
        if (status === 'processing') return `Procesando ${phase || 'análisis'}...`;
        return 'Actualizando el estado del análisis...';
    }

    private inferMimeType(file: File): string {
        if (file.type) return file.type;
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.docx')) {
            return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        }
        if (lower.endsWith('.txt')) return 'text/plain';
        return 'application/pdf';
    }

    private async analyzeDurableUploads(input: {
        sources: AnalysisUploadSource[];
        template: ExtractionTemplate | null;
        onProgress?: (event: AnalysisStreamEvent) => void;
        signal?: AbortSignal;
        accessToken: string;
        idempotencyKey: string;
    }): Promise<{ result: unknown; workflow?: unknown }> {
        const functionUrl = `${env.VITE_SUPABASE_URL}/functions/v1/analysis-jobs`;
        let accessToken = input.accessToken;

        const request = async (body: Record<string, unknown>) => {
            const send = (token: string) =>
                fetch(functionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                        apikey: env.VITE_SUPABASE_ANON_KEY,
                        'X-Idempotency-Key': input.idempotencyKey,
                    },
                    body: JSON.stringify(body),
                    signal: input.signal,
                });

            let response = await send(accessToken);
            if (response.status === 401) {
                const { data, error } = await supabase.auth.refreshSession();
                if (error || !data.session) throw new Error('Sesión expirada. Por favor, inicia sesión de nuevo.');
                accessToken = data.session.access_token;
                response = await send(accessToken);
            }

            let payload: Record<string, unknown> = {};
            try {
                payload = (await response.json()) as Record<string, unknown>;
            } catch {
                // The status below still provides an actionable error.
            }
            if (!response.ok) {
                throw new Error(
                    String(payload.error || payload.message || `Error del servidor (HTTP ${response.status})`)
                );
            }
            return payload;
        };

        const init = (await request({
            action: 'init',
            files: input.sources.map(({ file, sha256 }) => ({
                name: file.name,
                sizeBytes: file.size,
                mimeType: this.inferMimeType(file),
                sha256,
            })),
            template: input.template,
        })) as unknown as AnalysisJobInitResponse;

        if (!init.jobId) throw new Error('El servidor no devolvió el job durable');
        input.onProgress?.({
            type: 'job_created',
            timestamp: Date.now(),
            jobId: init.jobId,
            status: init.status,
            created: init.created,
        });

        if (init.status === 'completed') {
            return await this.recoverDurableResult(init.jobId, input.signal, input.onProgress, accessToken);
        }

        if (init.uploads.length > 0) {
            if (init.uploads.length !== input.sources.length) {
                throw new Error('El plan firmado no coincide con los documentos seleccionados');
            }

            input.onProgress?.({
                type: 'phase_started',
                timestamp: Date.now(),
                phase: 'ingestion',
                message: 'Subiendo documentos de forma segura...',
            });

            for (let index = 0; index < init.uploads.length; index++) {
                if (input.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
                const plan = init.uploads[index];
                const source = input.sources[index];
                if (plan.sha256 !== source.sha256 || plan.sizeBytes !== source.file.size) {
                    throw new Error(`El plan firmado no coincide con ${source.file.name}`);
                }

                const { error } = await supabase.storage
                    .from('analysis-pdfs')
                    .uploadToSignedUrl(plan.path, plan.token, source.file, {
                        contentType: plan.mimeType,
                    });
                if (error) throw new Error(`No se pudo subir ${source.file.name}: ${error.message}`);

                input.onProgress?.({
                    type: 'phase_progress',
                    timestamp: Date.now(),
                    phase: 'ingestion',
                    message: `Subida segura: ${index + 1}/${init.uploads.length} documentos`,
                    completedFiles: index + 1,
                    inProgressFiles: init.uploads.length - index - 1,
                    failedFiles: 0,
                });
            }
        }

        await request({ action: 'submit', jobId: init.jobId });
        input.onProgress?.({
            type: 'phase_completed',
            timestamp: Date.now(),
            phase: 'ingestion',
            message: 'Documentos guardados; análisis asíncrono en cola',
        });

        return await this.recoverDurableResult(init.jobId, input.signal, input.onProgress, accessToken);
    }

    private validateFinalResult(finalResult: { result: unknown; workflow?: unknown }): {
        content: LicitacionContent;
        workflow: unknown;
    } {
        logger.debug('[JobService] Result received, validating...');

        const parseResult = LicitacionContentSchema.safeParse(finalResult.result);
        let validated: LicitacionContent;
        if (!parseResult.success) {
            const issues = parseResult.error.issues
                .slice(0, 10)
                .map((issue) => ({ path: issue.path.join('.'), code: issue.code }));
            logger.error('[JobService] schema_validation_fallback: el resultado no cumple LicitacionContentSchema', {
                issueCount: parseResult.error.issues.length,
                issues,
            });
            validated = finalResult.result as LicitacionContent;
        } else {
            validated = parseResult.data;
        }

        logger.info('[JobService] Analysis completed and validated');
        return { content: validated, workflow: finalResult.workflow };
    }

    /**
     * Analyze documents using the phased pipeline.
     * Consumes SSE stream with phase progress events.
     */
    async analyzeWithAgents(
        pdfBase64: string,
        filename: string,
        template: ExtractionTemplate | null = null,
        onProgress?: (event: AnalysisStreamEvent) => void,
        files?: { name: string; base64: string }[],
        signal?: AbortSignal,
        uploadSources?: AnalysisUploadSource[]
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
            const idempotencyKey = createIdempotencyKey();

            if (uploadSources && uploadSources.length > 0) {
                const finalResult = await this.analyzeDurableUploads({
                    sources: uploadSources,
                    template,
                    onProgress,
                    signal,
                    accessToken: session.access_token,
                    idempotencyKey,
                });
                return this.validateFinalResult(finalResult);
            }

            const buildHeaders = (token: string) => ({
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                apikey: env.VITE_SUPABASE_ANON_KEY,
                'X-Idempotency-Key': idempotencyKey,
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
                jobId: null as string | null,
            };

            const processLine = (line: string) => {
                if (!line.trim() || !line.startsWith('data: ')) return;

                let event: AnalysisStreamEvent;
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

                if (event.type === 'job_created') {
                    state.jobId = event.jobId;
                }

                if (event.type === 'error') {
                    state.streamError = new Error(event.message || 'Error en streaming');
                    state.reading = false;
                }
            };

            try {
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
            } catch (streamReadError) {
                if (!state.jobId || signal?.aborted) throw streamReadError;
                logger.warn('[JobService] SSE interrumpido; recuperando el job durable...', {
                    jobId: state.jobId,
                });
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
            if (!state.finalResult && state.jobId) {
                state.finalResult = await this.recoverDurableResult(
                    state.jobId,
                    signal,
                    onProgress,
                    session.access_token
                );
            }
            if (!state.finalResult) throw new Error('No se recibió resultado final del stream');
            return this.validateFinalResult(state.finalResult);
        } catch (error: unknown) {
            logger.error('[JobService] Error en análisis:', error);
            throw error;
        }
    }
}

// SSE event types
export type StreamEvent = AnalysisStreamEvent;

export const jobService = new JobService();
