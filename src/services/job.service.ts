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
    /** Avance compacto de la fase en curso; el detalle vive en `phase_results`. */
    progress?: { done?: number; total?: number } | null;
}

/**
 * Normaliza el `progress` de la fila o del payload de Broadcast.
 *
 * Acota `done` al rango `[0, total]`: el emisor actual no puede salirse, pero
 * `done / total` alimenta directamente el porcentaje de la barra, así que un
 * valor fuera de rango se traduciría en una barra que retrocede o se pasa de
 * largo. Es la clase de invariante que se rompe sola al añadir un bloque.
 */
function readBlockProgress(value: unknown): { done: number; total: number } | null {
    if (!value || typeof value !== 'object') return null;
    const { done, total } = value as { done?: unknown; total?: unknown };
    if (typeof done !== 'number' || typeof total !== 'number') return null;
    if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return null;
    return { done: Math.min(Math.max(done, 0), total), total };
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
        let lastSignature: string | null = null;
        let lastReportedPhase: string | null = null;
        let sawProgress = false;

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
                try {
                    this.emitDurableProgress(
                        onProgress,
                        String(payload.status || ''),
                        String(payload.phase || ''),
                        readBlockProgress(payload.progress)
                    );
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
                    .select('status, result, error, phase, updated_at, progress')
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

                // Polling is the documented fallback for Broadcast, so it has to
                // report progress too — otherwise a browser that never receives a
                // Broadcast frame sits frozen on whatever message it got at submit
                // time while the worker is visibly advancing in the database.
                // Keyed on status:phase plus the block counter, never on
                // updated_at: a checkpoint that advances no block must not repeat
                // the same line, but one that does has to be reported.
                const blocks = readBlockProgress(state.progress);
                const progressKey = `${state.status}:${state.phase}:${blocks ? `${blocks.done}/${blocks.total}` : ''}`;
                if (progressKey !== lastReportedPhase) {
                    lastReportedPhase = progressKey;
                    try {
                        this.emitDurableProgress(
                            onProgress,
                            String(state.status || ''),
                            String(state.phase || ''),
                            blocks
                        );
                    } catch (err) {
                        logger.error('[JobService] onProgress callback error:', err);
                    }
                }

                // The job row only moves when a phase or step transitions, so a
                // change here is the one reliable "still alive" signal available
                // to the browser — block extraction writes nothing while it runs,
                // and a Broadcast wake proves the channel works, not the worker.
                const signature = `${state.status}:${state.phase}:${state.updated_at}`;
                if (lastSignature !== null && signature !== lastSignature) sawProgress = true;
                lastSignature = signature;

                await Promise.race([waitForRecoveryPoll(signal), realtimeWake()]);
            }
        } finally {
            await supabase.removeChannel(channel);
        }

        // Slow and dead look identical if you only read `status`. A job that did
        // not advance at all across the whole recovery window was interrupted:
        // telling its owner to come back later would send them to a history
        // entry that is never going to populate.
        throw new Error(
            sawProgress
                ? 'El análisis sigue en curso. Vuelve a abrirlo desde tu historial en unos minutos.'
                : 'El análisis se interrumpió antes de terminar y no dejó resultado recuperable. Vuelve a lanzarlo; si el expediente tiene varios PDF, prueba con menos documentos o más ligeros.'
        );
    }

    private toAnalysisPhase(phase: string): AnalysisPhase | undefined {
        if (phase === 'ingestion_map') return 'ingestion';
        if (['ingestion', 'document_map', 'extraction', 'consolidation', 'validation'].includes(phase)) {
            return phase as AnalysisPhase;
        }
        return undefined;
    }

    /**
     * Nombre en castellano de cada paso durable. El identificador interno
     * (`ingestion_map`, `extraction`…) se filtraba tal cual a la UI, que es
     * justo lo que hacía imposible saber qué estaba pasando.
     */
    private phaseLabel(phase: string): string | null {
        switch (phase) {
            case 'ingestion':
            case 'ingestion_map':
                return 'subiendo e indexando los documentos';
            case 'document_map':
                return 'analizando la estructura del expediente';
            case 'extraction':
                return 'extrayendo la información del expediente';
            case 'consolidation':
                return 'consolidando los resultados';
            case 'validation':
                return 'validando el resultado';
            default:
                return null;
        }
    }

    /**
     * Punto único por el que Broadcast y polling emiten progreso, para que las
     * dos fuentes cuenten exactamente lo mismo.
     *
     * Durante la extracción emite `extraction_progress`, que es el evento que el
     * mapeo de `ai.service` sabe convertir en avance dentro del rango de la
     * fase; en el resto de fases basta con `phase_progress`.
     */
    private emitDurableProgress(
        onProgress: ((event: AnalysisStreamEvent) => void) | undefined,
        status: string,
        phase: string,
        blocks: { done: number; total: number } | null
    ): void {
        if (!onProgress) return;

        if (phase === 'extraction' && blocks) {
            onProgress({
                type: 'extraction_progress',
                timestamp: Date.now(),
                // El stepper de `AnalyzingStep` se ilumina con la fase, así que
                // el evento debe llevarla aunque el progreso vaya por bloque.
                phase: 'extraction',
                blockIndex: blocks.done,
                totalBlocks: blocks.total,
                message: `Extrayendo información: ${blocks.done} de ${blocks.total} bloques...`,
            });
            return;
        }

        onProgress({
            type: 'phase_progress',
            timestamp: Date.now(),
            phase: this.toAnalysisPhase(phase),
            message: this.phaseMessage(status, phase),
        });
    }

    private phaseMessage(status: string, phase: string): string {
        const label = this.phaseLabel(phase);

        if (status === 'retrying') {
            return label ? `Reintentando: ${label}...` : 'Reintentando el paso actual...';
        }
        if (status === 'queued' || status === 'pending') {
            return label ? `En cola: ${label}...` : 'Análisis en cola...';
        }
        if (status === 'processing') {
            // La extracción es el tramo largo: el worker la trocea en slices, así
            // que conviene decir explícitamente que sigue avanzando y no colgada.
            if (phase === 'extraction') {
                return 'Extrayendo la información del expediente (puede tardar varios minutos)...';
            }
            return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}...` : 'Procesando el análisis...';
        }
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
