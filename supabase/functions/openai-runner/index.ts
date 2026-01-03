/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { OpenAIService } from "../_shared/services/openai.service.ts";
import { JobService } from "../_shared/services/job.service.ts";

/**
 * Controller: OpenAI Runner (Refactored)
 * Orchestrates Authorization -> Job Creation -> Background Analysis
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
    // STARTUP LOG
    console.log(`[openai-runner] Request Received. Version: vDoubleCheck_Final`);

    // CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 });
    }

    try {
        // 1. Parse Request Body (ONLY ONCE)
        const { action = 'start', jobId: existingJobId, pdfBase64, storageUrl, filename, hash } = await req.json();

        // 2. Auth & Validation
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        // 3. Initialize Clients
        const token = authHeader.replace(/^Bearer\s+/i, "");
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        // Check User
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
        if (userError || !user) throw new Error('Unauthorized: Invalid Token');

        // Admin Client (for Jobs)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Validate critical inputs
        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        const assistantId = Deno.env.get('VITE_OPENAI_ASSISTANT_ID') ?? Deno.env.get('OPENAI_ASSISTANT_ID');

        if (!openaiKey) throw new Error('Missing OPENAI_API_KEY');
        if (!assistantId) throw new Error('Missing VITE_OPENAI_ASSISTANT_ID');

        // --- Service Instances ---
        const jobService = new JobService(supabaseAdmin);

        // --- ROUTER ---

        if (action === 'start') {
            // Validate: Either storageUrl (new) OR pdfBase64 (legacy)
            if (!storageUrl && !pdfBase64) {
                throw new Error('Missing required parameter: storageUrl or pdfBase64');
            }
            if (!hash) {
                throw new Error('Missing required parameter: hash');
            }

            // 1. Create Job in DB
            const jobId = await jobService.createJob(user.id, filename, hash);
            console.log(`[Controller] Job ${jobId} created. Enqueueing...`);

            // 2. Enqueue Message in pgmq
            // Pass storageUrl (preferred) or pdfBase64 (legacy fallback)
            const { error: queueError } = await supabaseAdmin.rpc('send', {
                queue_name: 'analysis_queue',
                msg: {
                    jobId,
                    storageUrl: storageUrl || null,  // ✅ Preferred (Storage URL)
                    pdfBase64: pdfBase64 || null,    // 🔄 Legacy fallback
                    filename,
                    hash
                }
            });

            if (queueError) {
                console.error('[Controller] Queue error:', queueError);
                await jobService.failJob(jobId, `Failed to enqueue: ${queueError.message}`);
                throw new Error(`Failed to enqueue job: ${queueError.message}`);
            }

            console.log(`[Controller] Job ${jobId} enqueued successfully`);

            // 3. Return immediately (job will be processed by queue-processor)
            return new Response(
                JSON.stringify({ jobId, status: 'queued' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
            );

        } else if (action === 'sync') {
            // Legacy sync endpoint - keep for backward compatibility
            // In new architecture, sync is handled by queue-processor via pg_cron
            if (!existingJobId) throw new Error('Missing jobId for sync');

            // Load Job Metadata
            const { data: job, error: jobError } = await supabaseAdmin
                .from('analysis_jobs')
                .select('metadata, status')
                .eq('id', existingJobId)
                .single();

            if (jobError || !job) throw new Error('Job not found');
            if (job.status === 'completed' || job.status === 'failed') {
                return new Response(JSON.stringify({ status: job.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            }

            const meta = job.metadata || {};
            if (!meta.threadId || !meta.runId) {
                // Might be strictly in 'uploading' phase still?
                // Just return processing
                return new Response(JSON.stringify({ status: 'processing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            }

            // Check Status
            const aiService = new OpenAIService({ apiKey: openaiKey || '', assistantId: assistantId || '', maxRetries: 3 });

            try {
                const runStatus = await aiService.checkRunStatus(meta.threadId, meta.runId);

                if (runStatus.status === 'completed') {
                    // Save
                    await jobService.completeJob(existingJobId, runStatus.result, meta.filename, meta.hash);
                    // Cleanup
                    await aiService.cleanup(meta.vectorStoreId, meta.fileId);

                    return new Response(JSON.stringify({ status: 'completed', result: runStatus.result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
                } else if (runStatus.status === 'failed') {
                    await jobService.failJob(existingJobId, runStatus.error || 'OpenAI Run Failed');
                    await aiService.cleanup(meta.vectorStoreId, meta.fileId);

                    return new Response(JSON.stringify({ status: 'failed', error: runStatus.error }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
                } else {
                    // Still processing
                    return new Response(JSON.stringify({ status: 'processing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
                }
            } catch (syncError: any) {
                // Self-Healing for Zombie Runs (Empty Files)
                if (syncError.message.includes('ZOMBIE_RUN_DETECTED')) {
                    console.log('[Controller] Zombie Run Detected. Auto-completing with empty result.');

                    const emptyResult = {
                        titulo_licitacion: "Documento Vacío o illegible",
                        organismo: "Desconocido",
                        presupuesto_base: 0,
                        garantia_requerida: "No aplicable",
                        solvencia_tecnica: "No detectada",
                        solvencia_economica: "No detectada",
                        criterios_adjudicacion: []
                    };

                    await jobService.completeJob(existingJobId, emptyResult);
                    await aiService.cleanup(meta.vectorStoreId, meta.fileId);

                    return new Response(JSON.stringify({ status: 'completed', result: emptyResult }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
                }

                // NON-BLOCKING OPTIMIZATION:
                // If message is not ready (propagation lag), just keep "processing".
                if (syncError.message.includes('RESULT_NOT_READY')) {
                    console.log('[Controller] Result not ready yet (propagation). Continuing poll cycle.');
                    return new Response(JSON.stringify({ status: 'processing', message: 'Finalizando respuesta IA...' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
                }

                console.error('[Controller] Sync Exception:', syncError);

                // Exfiltrate Thread ID for debugging
                let debugInfo = "";
                try {
                    const { data } = await supabaseAdmin.from('analysis_jobs').select('metadata').eq('id', existingJobId).single();
                    if (data?.metadata?.threadId) {
                        debugInfo = ` (Thread: ${data.metadata.threadId})`;
                    }
                } catch (e) { /* ignore */ }

                await jobService.failJob(existingJobId, syncError.message + debugInfo);
                await aiService.cleanup(meta.vectorStoreId, meta.fileId);

                return new Response(JSON.stringify({ status: 'failed', error: syncError.message + debugInfo }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            }

        } else {
            throw new Error('Invalid action');
        }

    } catch (error: any) {
        console.error('[Controller] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
