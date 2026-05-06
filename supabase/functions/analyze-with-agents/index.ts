/**
 * Edge Function: analyze-with-agents
 *
 * Pipeline de análisis por fases:
 *   A. Ingesta → B. Mapa Documental → C. Extracción por Bloques →
 *   D. Consolidación → E. Validación
 *
 * Auth model:
 *   `verify_jwt = true` (config.toml) means the Supabase platform validates
 *   the bearer token and rejects unauthenticated requests with 401 before
 *   this function is invoked. We still need to *resolve the user* from the
 *   token (for rate-limiting and resource ownership), but we no longer
 *   need the manual reject-on-missing-token block that used to live here.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limiter.ts';
import OpenAI from 'npm:openai@6.33.0';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — npm: specifier resolved by Deno
import { setTraceProcessors } from '../_shared/agents/sdk.ts';
import { SupabaseLogTraceProcessor } from '../_shared/agents/tracing.ts';
import { createPipelineContext } from '../_shared/agents/context.ts';

import { runIngestion } from './phases/ingestion.ts';
import { runDocumentMap } from './phases/document-map.ts';
import { runBlockExtraction } from './phases/block-extraction.ts';
import { runConsolidation } from './phases/consolidation.ts';
import { runValidation } from './phases/validation.ts';
import { getCleanupTimestamp, runOpportunisticCleanup, cleanupJobResources } from './cleanup.ts';
import { JobService } from '../_shared/services/job.service.ts';
import { PIPELINE_TIMEOUT_MS, MAX_PAYLOAD_BYTES, API_CALL_TIMEOUT_MS } from '../_shared/config.ts';
import { mapOpenAIError } from '../_shared/utils/error.utils.ts';
import { callWithTimeout } from '../_shared/utils/timeout.ts';
import { GUIDE_CONTENT } from './guide-content.ts';
import type { AnalysisPhase, AnalysisStreamEvent } from '../../../src/shared/analysis-contract.ts';
import type { IngestionProgressUpdate } from './phases/ingestion.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no configurada');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const MAX_REQUESTS_MSG = '10 análisis/hora';

setTraceProcessors([new SupabaseLogTraceProcessor()]);

const guideContent = GUIDE_CONTENT;
if (!guideContent || guideContent.length < 100) {
    throw new Error('Guide content failed to load or is too short');
}
console.log(`[init] Guía de lectura cargada: ${guideContent.length} chars`);

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: getCorsHeaders(req) });
    }

    const requestId = crypto.randomUUID();

    try {
        console.log(`[analyze] Request received reqId=${requestId}`);

        // Token is guaranteed present by verify_jwt=true at the platform layer.
        // We still extract it to resolve the user record for rate-limiting and
        // resource ownership.
        const authHeader = req.headers.get('authorization') || '';
        const token = authHeader.replace('Bearer ', '');

        const { createClient } = await import('npm:@supabase/supabase-js@2.39.3');
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const {
            data: { user },
        } = await supabaseClient.auth.getUser(token);

        if (!user) {
            // verify_jwt=true should have made this unreachable, but defend in
            // depth: if Supabase ever forwards a request whose token resolves to
            // no user, fail closed.
            return new Response(JSON.stringify({ error: 'No se pudo resolver el usuario' }), {
                status: 401,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            });
        }

        const rateCheck = checkRateLimit(user.id);
        if (!rateCheck.allowed) {
            const retryAfterSec = Math.ceil((rateCheck.retryAfterMs || 0) / 1000);
            return new Response(
                JSON.stringify({
                    error: `Límite de análisis excedido (${MAX_REQUESTS_MSG}). Reintente en ${retryAfterSec}s.`,
                }),
                {
                    status: 429,
                    headers: {
                        ...getCorsHeaders(req),
                        'Content-Type': 'application/json',
                        'Retry-After': String(retryAfterSec),
                    },
                }
            );
        }

        const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
        if (contentLength > MAX_PAYLOAD_BYTES) {
            return new Response(
                JSON.stringify({
                    error: `Payload demasiado grande (${Math.round(contentLength / 1024 / 1024)}MB). Máximo: 50MB.`,
                }),
                { status: 413, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
            );
        }

        const { pdfBase64, filename, template, files } = await req.json();

        if (!pdfBase64 && (!files || files.length === 0)) {
            return new Response(JSON.stringify({ error: 'pdfBase64 o files requeridos' }), {
                status: 400,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            });
        }

        console.log(`[analyze] Processing: ${filename || 'documento.pdf'} reqId=${requestId}`);
        if (files && files.length > 0) {
            console.log(`[analyze] Additional documents: ${files.length}`);
        }

        runOpportunisticCleanup(openai, async () => {
            const { data } = await supabaseClient
                .from('analysis_jobs')
                .select('id, vector_store_id, file_ids')
                .lt('cleanup_at', new Date().toISOString())
                .not('vector_store_id', 'is', null)
                .limit(5);
            if (data && data.length > 0) {
                const ids = data.map((j: { id: string }) => j.id);
                await supabaseClient
                    .from('analysis_jobs')
                    .update({ vector_store_id: null, file_ids: null })
                    .in('id', ids);
            }
            return data || [];
        }).catch((err) =>
            console.warn('[analyze] Opportunistic cleanup failed:', {
                error: err instanceof Error ? err.message : String(err),
                userId: user.id,
                requestId,
            })
        );

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                let completed = false;

                const sendEvent = <T extends AnalysisStreamEvent['type']>(
                    type: T,
                    data: Omit<Extract<AnalysisStreamEvent, { type: T }>, 'type' | 'timestamp'>
                ) => {
                    if (completed) return;
                    try {
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ type, timestamp: Date.now(), ...data })}\n\n`)
                        );
                    } catch {
                        // Controller closed
                    }
                };

                const sendProgress = (phase: AnalysisPhase, update: string | IngestionProgressUpdate) => {
                    if (typeof update === 'string') {
                        sendEvent('phase_progress', { phase, message: update });
                        return;
                    }
                    sendEvent('phase_progress', {
                        phase,
                        message: update.message,
                        elapsedMs: update.elapsedMs,
                        completedFiles: update.completedFiles,
                        inProgressFiles: update.inProgressFiles,
                        failedFiles: update.failedFiles,
                    });
                };

                const keepAlive = setInterval(() => {
                    if (completed) {
                        clearInterval(keepAlive);
                        return;
                    }
                    sendEvent('heartbeat', {});
                }, 10000);

                let vectorStoreId: string | undefined;
                let fileIds: string[] | undefined;
                const jobService = new JobService(supabaseClient);
                let jobId: string | null = null;

                const timeoutId = setTimeout(() => {
                    if (!completed) {
                        console.error(`[analyze] Execution timeout reqId=${requestId}`);
                        if (vectorStoreId || fileIds) {
                            cleanupJobResources(openai, vectorStoreId, fileIds).catch((e) =>
                                console.warn('[analyze] Timeout cleanup failed:', e)
                            );
                        }
                        sendEvent('error', {
                            message: 'Tiempo de ejecución excedido. Intente con documentos más pequeños.',
                        });
                        completed = true;
                        clearInterval(keepAlive);
                        controller.close();
                    }
                }, PIPELINE_TIMEOUT_MS);

                try {
                    sendEvent('phase_started', { phase: 'ingestion', message: 'Subiendo documentos...' });
                    const ingestion = await callWithTimeout(
                        runIngestion({
                            openai,
                            pdfBase64,
                            filename: filename || 'documento.pdf',
                            files,
                            onProgress: (update) => sendProgress('ingestion', update),
                        }),
                        API_CALL_TIMEOUT_MS * 2,
                        'Ingestion'
                    );
                    vectorStoreId = ingestion.vectorStoreId;
                    fileIds = ingestion.fileIds;
                    sendEvent('phase_completed', { phase: 'ingestion', message: 'Documentos indexados' });

                    try {
                        jobId = await jobService.createJob(
                            user.id,
                            filename || 'documento.pdf',
                            ingestion.vectorStoreId,
                            ingestion.fileIds,
                            getCleanupTimestamp()
                        );
                    } catch (dbErr) {
                        console.warn('[analyze] Failed to persist job:', dbErr);
                    }

                    const pipelineContext = createPipelineContext({
                        vectorStoreId: ingestion.vectorStoreId,
                        fileNames: ingestion.fileNames,
                        guideExcerpt: '',
                        userId: user.id,
                        requestId,
                        customTemplate: template ?? null,
                    });

                    sendEvent('phase_started', { phase: 'document_map', message: 'Analizando estructura...' });
                    const documentMap = await runDocumentMap({
                        context: pipelineContext,
                        guideContent,
                        onProgress: (msg) => sendProgress('document_map', msg),
                    });
                    sendEvent('phase_completed', {
                        phase: 'document_map',
                        message: `${documentMap.documentos.length} documentos identificados`,
                    });

                    if (jobId) {
                        jobService
                            .updatePhase(jobId, 'document_map', documentMap)
                            .catch((e) => console.warn('[analyze] Job DB update failed:', e));
                    }

                    sendEvent('phase_started', { phase: 'extraction', message: 'Extrayendo información...' });
                    const extraction = await runBlockExtraction({
                        openai,
                        vectorStoreId: ingestion.vectorStoreId,
                        documentMap,
                        guideContent,
                        template,
                        context: pipelineContext,
                        onProgress: (msg, idx, total) => {
                            sendProgress('extraction', msg);
                            sendEvent('extraction_progress', {
                                blockIndex: idx,
                                totalBlocks: total,
                                message: msg,
                            });
                        },
                        onRetry: ({ blockName, attempt, maxAttempts, waitMs, reason, blockIndex, totalBlocks }) => {
                            sendEvent('retry_scheduled', {
                                phase: 'extraction',
                                blockName,
                                attempt,
                                maxAttempts,
                                waitMs,
                                reason,
                                blockIndex,
                                totalBlocks,
                            });
                        },
                    });
                    sendEvent('phase_completed', {
                        phase: 'extraction',
                        message: `${extraction.blocks.length} bloques extraídos`,
                    });

                    if (jobId) {
                        jobService
                            .updatePhase(jobId, 'extraction')
                            .catch((e) => console.warn('[analyze] Job DB update failed:', e));
                    }

                    sendEvent('phase_started', { phase: 'consolidation', message: 'Consolidando resultados...' });
                    const consolidated = await callWithTimeout(
                        Promise.resolve(
                            runConsolidation({
                                blocks: extraction.blocks,
                                customTemplate: extraction.customTemplate,
                                onProgress: (msg) => sendProgress('consolidation', msg),
                            })
                        ),
                        20_000,
                        'Consolidation'
                    );
                    sendEvent('phase_completed', { phase: 'consolidation', message: 'Resultados consolidados' });

                    sendEvent('phase_started', { phase: 'validation', message: 'Validando resultado...' });
                    const { result, workflow } = await callWithTimeout(
                        Promise.resolve(
                            runValidation({
                                consolidated,
                                ingestion: ingestion.diagnostics,
                                extraction: extraction.diagnostics,
                                onProgress: (msg) => sendProgress('validation', msg),
                            })
                        ),
                        15_000,
                        'Validation'
                    );
                    sendEvent('phase_completed', {
                        phase: 'validation',
                        message: `Quality: ${workflow.quality?.overall || 'N/A'}`,
                    });

                    const finalOutput = { result, workflow };
                    console.log(
                        `[analyze] Pipeline completed reqId=${requestId} quality=${workflow.quality?.overall}`
                    );

                    if (jobId) {
                        jobService
                            .completeJob(jobId, finalOutput)
                            .catch((e) => console.warn('[analyze] Job DB update failed:', e));
                    }

                    sendEvent('complete', finalOutput);
                } catch (error: unknown) {
                    const errMsg = mapOpenAIError(error);
                    console.error(`[analyze] Pipeline error reqId=${requestId}:`, error);
                    if (jobId) {
                        jobService
                            .failJob(jobId, errMsg)
                            .catch((e) => console.warn('[analyze] Job DB update failed:', e));
                    }
                    if (vectorStoreId || fileIds) {
                        cleanupJobResources(openai, vectorStoreId, fileIds).catch((e) =>
                            console.warn('[analyze] Error cleanup failed:', e)
                        );
                    }
                    sendEvent('error', { message: errMsg });
                } finally {
                    completed = true;
                    clearInterval(keepAlive);
                    clearTimeout(timeoutId);
                    try {
                        controller.close();
                    } catch {
                        // Already closed
                    }
                }
            },
        });

        return new Response(readable, {
            headers: {
                ...getCorsHeaders(req),
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (error: unknown) {
        console.error(`[analyze] Error reqId=${requestId}:`, error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Internal server error',
            }),
            {
                status: 500,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            }
        );
    }
});
