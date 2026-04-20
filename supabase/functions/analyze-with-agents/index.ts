/**
 * Edge Function: analyze-with-agents
 *
 * Pipeline de análisis por fases:
 *   A. Ingesta → B. Mapa Documental → C. Extracción por Bloques →
 *   D. Consolidación → E. Validación
 *
 * Usa Responses API de OpenAI con file_search para cada fase.
 * SSE para progreso en tiempo real.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limiter.ts';
import OpenAI from 'npm:openai@6.33.0';

// Phase imports
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

// ─── Configuration ────────────────────────────────────────────────────────────

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no configurada');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const MAX_REQUESTS_MSG = '10 análisis/hora';

// Guide content bundled at deploy time via guide-content.ts
const guideContent = GUIDE_CONTENT;
if (!guideContent || guideContent.length < 100) {
    throw new Error('Guide content failed to load or is too short');
}
console.log(`[init] Guía de lectura cargada: ${guideContent.length} chars`);

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
    // CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: getCorsHeaders(req) });
    }

    try {
        console.log('[analyze] Request received');

        // 0. Authentication
        const authHeader = req.headers.get('authorization') || '';
        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            return new Response(JSON.stringify({ error: 'Token de autenticación requerido' }), {
                status: 401,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            });
        }

        const { createClient } = await import('npm:@supabase/supabase-js@2.39.3');
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const {
            data: { user },
            error: authError,
        } = await supabaseClient.auth.getUser(token);

        if (authError || !user) {
            console.error('[analyze] Auth error:', authError);
            return new Response(JSON.stringify({ error: 'Token inválido o expirado' }), {
                status: 401,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            });
        }

        // Rate limiting
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

        // 1. Validate payload
        const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
        if (contentLength > MAX_PAYLOAD_BYTES) {
            return new Response(
                JSON.stringify({
                    error: `Payload demasiado grande (${Math.round(contentLength / 1024 / 1024)}MB). Máximo: 50MB.`,
                }),
                { status: 413, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
            );
        }

        // 2. Parse request
        const { pdfBase64, filename, template, files } = await req.json();

        if (!pdfBase64 && (!files || files.length === 0)) {
            return new Response(JSON.stringify({ error: 'pdfBase64 o files requeridos' }), {
                status: 400,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            });
        }

        console.log(`[analyze] Processing: ${filename || 'documento.pdf'}`);
        if (files && files.length > 0) {
            console.log(`[analyze] Additional documents: ${files.length}`);
        }

        // Opportunistic cleanup of expired resources (non-blocking)
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
            })
        );

        // 3. Create SSE stream with pipeline execution
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                let completed = false;

                // SSE helpers
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

                // Keepalive heartbeat
                const keepAlive = setInterval(() => {
                    if (completed) {
                        clearInterval(keepAlive);
                        return;
                    }
                    sendEvent('heartbeat', {});
                }, 10000);

                // Track resources for cleanup on error
                let vectorStoreId: string | undefined;
                let fileIds: string[] | undefined;
                const jobService = new JobService(supabaseClient);
                let jobId: string | null = null;

                // Timeout with resource cleanup
                const timeoutId = setTimeout(() => {
                    if (!completed) {
                        console.error('[analyze] Execution timeout');
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
                    // ═══ FASE A: INGESTA ═══
                    sendEvent('phase_started', { phase: 'ingestion', message: 'Subiendo documentos...' });
                    const ingestion = await callWithTimeout(
                        runIngestion({
                            openai,
                            pdfBase64,
                            filename: filename || 'documento.pdf',
                            files,
                            onProgress: (update) => sendProgress('ingestion', update),
                        }),
                        API_CALL_TIMEOUT_MS * 2, // 3min — uploads + indexing can be slow
                        'Ingestion'
                    );
                    vectorStoreId = ingestion.vectorStoreId;
                    fileIds = ingestion.fileIds;
                    sendEvent('phase_completed', { phase: 'ingestion', message: 'Documentos indexados' });

                    // Persist job via JobService
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

                    // ═══ FASE B: MAPA DOCUMENTAL ═══
                    sendEvent('phase_started', { phase: 'document_map', message: 'Analizando estructura...' });
                    const documentMap = await runDocumentMap({
                        openai,
                        vectorStoreId: ingestion.vectorStoreId,
                        fileNames: ingestion.fileNames,
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

                    // ═══ FASE C: EXTRACCIÓN POR BLOQUES ═══
                    sendEvent('phase_started', { phase: 'extraction', message: 'Extrayendo información...' });
                    const extraction = await runBlockExtraction({
                        openai,
                        vectorStoreId: ingestion.vectorStoreId,
                        documentMap,
                        guideContent,
                        template,
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

                    // ═══ FASE D: CONSOLIDACIÓN ═══
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

                    // ═══ FASE E: VALIDACIÓN ═══
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

                    // ═══ COMPLETE ═══
                    const finalOutput = { result, workflow };
                    console.log(`[analyze] Pipeline completed. Quality: ${workflow.quality?.overall}`);

                    if (jobId) {
                        jobService
                            .completeJob(jobId, finalOutput)
                            .catch((e) => console.warn('[analyze] Job DB update failed:', e));
                    }

                    sendEvent('complete', finalOutput);
                } catch (error: unknown) {
                    const errMsg = mapOpenAIError(error);
                    console.error('[analyze] Pipeline error:', error);
                    if (jobId) {
                        jobService
                            .failJob(jobId, errMsg)
                            .catch((e) => console.warn('[analyze] Job DB update failed:', e));
                    }
                    // Cleanup OpenAI resources on pipeline failure (non-blocking)
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
        console.error('[analyze] Error:', error);
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
