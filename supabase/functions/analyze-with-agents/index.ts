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
import OpenAI from 'npm:openai@7.8.0';

// Phase imports
import { runIngestion } from './phases/ingestion.ts';
import { runDocumentMap } from './phases/document-map.ts';
import { runBlockExtraction } from './phases/block-extraction.ts';
import { runConsolidation } from './phases/consolidation.ts';
import { runValidation } from './phases/validation.ts';
import { getCleanupTimestamp } from './cleanup.ts';

// ─── Configuration ────────────────────────────────────────────────────────────

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no configurada');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const MAX_REQUESTS_MSG = '10 análisis/hora';
const MAX_PAYLOAD_BYTES = 50 * 1024 * 1024; // 50MB
const TIMEOUT_MS = 360000; // 6 minutes

// Load guide content once at startup
let guideContent = '';
try {
    const guiaPath = new URL('./guia-lectura-pliegos.md', import.meta.url);
    guideContent = await Deno.readTextFile(guiaPath);
    console.log(`[init] Guía de lectura cargada: ${guideContent.length} chars`);
} catch (e) {
    console.error('[init] No se pudo cargar la guía de lectura:', e);
}

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

        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const {
            data: { user },
            error: authError,
        } = await supabaseClient.auth.getUser();

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

        // 3. Create SSE stream with pipeline execution
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                let completed = false;

                // SSE helpers
                const sendEvent = (type: string, data: Record<string, unknown>) => {
                    if (completed) return;
                    try {
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ type, timestamp: Date.now(), ...data })}\n\n`)
                        );
                    } catch {
                        // Controller closed
                    }
                };

                const sendProgress = (phase: string, message: string) => {
                    sendEvent('phase_progress', { phase, message });
                };

                // Keepalive heartbeat
                const keepAlive = setInterval(() => {
                    if (completed) {
                        clearInterval(keepAlive);
                        return;
                    }
                    sendEvent('heartbeat', {});
                }, 10000);

                // Timeout
                const timeoutId = setTimeout(() => {
                    if (!completed) {
                        console.error('[analyze] Execution timeout');
                        sendEvent('error', {
                            message: 'Tiempo de ejecución excedido. Intente con documentos más pequeños.',
                        });
                        completed = true;
                        clearInterval(keepAlive);
                        controller.close();
                    }
                }, TIMEOUT_MS);

                try {
                    // ═══ FASE A: INGESTA ═══
                    sendEvent('phase_started', { phase: 'ingestion', message: 'Subiendo documentos...' });
                    const ingestion = await runIngestion({
                        openai,
                        pdfBase64,
                        filename: filename || 'documento.pdf',
                        files,
                        onProgress: (msg) => sendProgress('ingestion', msg),
                    });
                    sendEvent('phase_completed', { phase: 'ingestion', message: 'Documentos indexados' });

                    // Persist job metadata
                    try {
                        await supabaseClient.from('analysis_jobs').insert({
                            user_id: user.id,
                            status: 'processing',
                            phase: 'ingestion',
                            vector_store_id: ingestion.vectorStoreId,
                            file_ids: ingestion.fileIds,
                            metadata: {
                                filename: filename || 'documento.pdf',
                                fileNames: ingestion.fileNames,
                            },
                            cleanup_at: getCleanupTimestamp(),
                        });
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
                    });
                    sendEvent('phase_completed', {
                        phase: 'extraction',
                        message: `${extraction.blocks.length} bloques extraídos`,
                    });

                    // ═══ FASE D: CONSOLIDACIÓN ═══
                    sendEvent('phase_started', { phase: 'consolidation', message: 'Consolidando resultados...' });
                    const consolidated = runConsolidation({
                        blocks: extraction.blocks,
                        customTemplate: extraction.customTemplate,
                        onProgress: (msg) => sendProgress('consolidation', msg),
                    });
                    sendEvent('phase_completed', { phase: 'consolidation', message: 'Resultados consolidados' });

                    // ═══ FASE E: VALIDACIÓN ═══
                    sendEvent('phase_started', { phase: 'validation', message: 'Validando resultado...' });
                    const { result, workflow } = runValidation({
                        consolidated,
                        onProgress: (msg) => sendProgress('validation', msg),
                    });
                    sendEvent('phase_completed', {
                        phase: 'validation',
                        message: `Quality: ${workflow.quality?.overall || 'N/A'}`,
                    });

                    // ═══ COMPLETE ═══
                    const finalOutput = { result, workflow };
                    console.log(`[analyze] Pipeline completed. Quality: ${workflow.quality?.overall}`);

                    sendEvent('complete', { result: finalOutput });
                } catch (error: unknown) {
                    const errMsg = error instanceof Error ? error.message : 'Unknown error';
                    console.error('[analyze] Pipeline error:', error);
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
