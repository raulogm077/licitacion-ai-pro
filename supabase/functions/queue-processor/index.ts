/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { OpenAIService } from "../_shared/services/openai.service.ts";
import { JobService } from "../_shared/services/job.service.ts";

/**
 * Queue Processor: Async Worker for PDF Analysis
 * 
 * Actions:
 * - 'process': Dequeue messages and start OpenAI processing
 * - 'sync': Check status of running OpenAI jobs
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    console.log(`[queue-processor] Request Received. Version: v1.0`);

    // CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { action = 'process' } = await req.json();

        // Initialize Supabase Admin (service role)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        const assistantId = Deno.env.get('VITE_OPENAI_ASSISTANT_ID') ?? Deno.env.get('OPENAI_ASSISTANT_ID');

        // ===== ACTION: PROCESS =====
        if (action === 'process') {
            console.log('[queue-processor] Action: PROCESS - Dequeueing messages...');

            // Dequeue 1 message (visibility timeout: 600s = 10 min)
            const { data: messages, error: dequeueError } = await supabaseAdmin.rpc('read', {
                queue_name: 'analysis_queue',
                vt: 600, // 10 minutes visibility timeout
                qty: 1   // Process 1 at a time
            });

            if (dequeueError) {
                console.error('[queue-processor] Dequeue error:', dequeueError);
                return new Response(
                    JSON.stringify({ error: 'Failed to dequeue', details: dequeueError.message }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
                );
            }

            if (!messages || messages.length === 0) {
                console.log('[queue-processor] No messages in queue');
                return new Response(
                    JSON.stringify({ status: 'idle', message: 'No messages to process' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                );
            }

            const msg = messages[0];
            const { msg_id, message } = msg;
            const { jobId, storageUrl, pdfBase64, filename, hash } = message;

            console.log(`[queue-processor] Processing job ${jobId}, msg_id ${msg_id}`);

            try {
                const jobService = new JobService(supabaseAdmin);
                const aiService = new OpenAIService({
                    apiKey: openaiKey || '',
                    assistantId: assistantId || '',
                    maxRetries: 5
                });

                // Get PDF data (support both storage URL and legacy base64)
                let pdfDataBase64;
                if (storageUrl) {
                    // Download from storage
                    const { data: pdfBlob, error: storageError } = await supabaseAdmin.storage
                        .from('analysis-pdfs')
                        .download(storageUrl);

                    if (storageError) throw new Error(`Storage download failed: ${storageError.message}`);

                    const arrayBuffer = await pdfBlob.arrayBuffer();
                    const bytes = new Uint8Array(arrayBuffer);
                    pdfDataBase64 = btoa(String.fromCharCode(...bytes));
                } else if (pdfBase64) {
                    // Legacy: use base64 directly from message
                    pdfDataBase64 = pdfBase64;
                } else {
                    throw new Error('No PDF data provided (missing storageUrl and pdfBase64)');
                }

                // Step 1: Upload to OpenAI
                await jobService.updateProgress(jobId, 'upload', 'Subiendo documento a OpenAI...', filename, hash);
                const fileId = await aiService.uploadFile(pdfDataBase64, filename || 'doc.pdf');

                // Step 2: Create Vector Store
                await jobService.updateProgress(jobId, 'indexing', 'Creando índice...', filename, hash);
                const vsName = `Licitacion-${new Date().getFullYear()}-${hash.substring(0, 8)}`;
                const vectorStoreId = await aiService.createVectorStore(vsName, fileId);

                // Step 3: Start Run (non-blocking)
                await jobService.updateProgress(jobId, 'analyzing', 'IA iniciada. Procesamiento en segundo plano...');
                const instruction = `Analiza el documento legal adjunto (Pliego). Extrae los datos siguiendo estrictamente el esquema JSON definido.
                    
                    IMPORTANTE: Si no encuentras información o el documento parece vacío, NO termines sin responder. Devuelve el JSON con valores vacíos o nulos, pero SIEMPRE devuelve un JSON válido.`;

                const { threadId, runId } = await aiService.startRun(vectorStoreId, instruction);

                // Step 4: Save metadata for sync
                await jobService.updateMetadata(jobId, {
                    step: 'analyzing',
                    message: 'IA pensando...',
                    filename,
                    hash,
                    threadId,
                    runId,
                    fileId,
                    vectorStoreId
                });

                console.log(`[queue-processor] Job ${jobId} started successfully. Run: ${runId}`);

                // Archive message (success - job is now being processed)
                await supabaseAdmin.rpc('archive', {
                    queue_name: 'analysis_queue',
                    msg_ids: [msg_id]
                });

                return new Response(
                    JSON.stringify({ status: 'processing', jobId, runId }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                );

            } catch (error: any) {
                console.error(`[queue-processor] Error processing job ${jobId}:`, error);

                // Mark job as failed
                const jobService = new JobService(supabaseAdmin);
                await jobService.failJob(jobId, error.message);

                // Archive message (failed - don't retry)
                await supabaseAdmin.rpc('archive', {
                    queue_name: 'analysis_queue',
                    msg_ids: [msg_id]
                });

                return new Response(
                    JSON.stringify({ status: 'failed', jobId, error: error.message }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                );
            }
        }

        // ===== ACTION: SYNC =====
        if (action === 'sync') {
            console.log('[queue-processor] Action: SYNC - Checking OpenAI runs...');

            // Find all processing jobs with runId
            const { data: jobs, error: jobsError } = await supabaseAdmin
                .from('analysis_jobs')
                .select('*')
                .eq('status', 'processing')
                .not('metadata->runId', 'is', null)
                .limit(10); // Process max 10 at a time

            if (jobsError) {
                console.error('[queue-processor] Jobs query error:', jobsError);
                return new Response(
                    JSON.stringify({ error: 'Failed to query jobs', details: jobsError.message }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
                );
            }

            if (!jobs || jobs.length === 0) {
                console.log('[queue-processor] No jobs to sync');
                return new Response(
                    JSON.stringify({ status: 'idle', message: 'No jobs to sync' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                );
            }

            console.log(`[queue-processor] Syncing ${jobs.length} jobs...`);

            const results = [];
            const jobService = new JobService(supabaseAdmin);
            const aiService = new OpenAIService({
                apiKey: openaiKey || '',
                assistantId: assistantId || '',
                maxRetries: 3
            });

            for (const job of jobs) {
                try {
                    const { threadId, runId, vectorStoreId, fileId, filename, hash } = job.metadata;

                    const runStatus = await aiService.checkRunStatus(threadId, runId);

                    if (runStatus.status === 'completed') {
                        await jobService.completeJob(job.id, runStatus.result, filename, hash);
                        await aiService.cleanup(vectorStoreId, fileId);
                        results.push({ jobId: job.id, status: 'completed' });
                    } else if (runStatus.status === 'failed') {
                        await jobService.failJob(job.id, runStatus.error || 'OpenAI Run Failed');
                        await aiService.cleanup(vectorStoreId, fileId);
                        results.push({ jobId: job.id, status: 'failed', error: runStatus.error });
                    } else {
                        // Still processing
                        results.push({ jobId: job.id, status: 'processing' });
                    }
                } catch (error: any) {
                    console.error(`[queue-processor] Error syncing job ${job.id}:`, error);
                    results.push({ jobId: job.id, status: 'error', error: error.message });
                }
            }

            return new Response(
                JSON.stringify({ status: 'synced', results }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }

        // Unknown action
        return new Response(
            JSON.stringify({ error: 'Invalid action. Use "process" or "sync"' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );

    } catch (error: any) {
        console.error('[queue-processor] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
