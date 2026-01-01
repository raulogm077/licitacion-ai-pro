/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { OpenAIService } from "./services/openai.service.ts";
import { JobService } from "./services/job.service.ts";

/**
 * Controller: OpenAI Runner (Refactored)
 * Orchestrates Authorization -> Job Creation -> Background Analysis
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // STARTUP LOG
    console.log(`[openai-runner] Request Received. Version: vDoubleCheck_Final`);

    // CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Auth & Validation
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        const { pdfBase64, filename, hash, action = 'start', jobId: existingJobId } = await req.json();

        // 2. Initialize Clients
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
        const jobService = new JobService(supabaseAdmin);
        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        const assistantId = Deno.env.get('VITE_OPENAI_ASSISTANT_ID') ?? Deno.env.get('OPENAI_ASSISTANT_ID');

        // --- ROUTER ---

        if (action === 'start') {
            if (!pdfBase64 || !hash) throw new Error('Missing required body fields (pdfBase64, hash)');

            // 3. Create Job
            const jobId = await jobService.createJob(user.id, filename, hash);
            console.log(`[Controller] Job ${jobId} created. Starting Sequence...`);

            // 4. Start (Upload -> Index -> Run)
            // Fire-and-forget to ensure immediate response (<1s)
            // The 'sync' endpoint handles the case where metadata is not yet ready.
            const task = startAnalysisSequence({
                jobId, pdfBase64, filename, hash, jobService, openaiKey, assistantId
            });

            EdgeRuntime.waitUntil(task);

            return new Response(
                JSON.stringify({ jobId, status: 'started' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
            );

        } else if (action === 'sync') {
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

// --- Startup Sequence ---

interface RunParams {
    jobId: string;
    pdfBase64: string;
    filename?: string;
    hash: string;
    jobService: JobService;
    openaiKey?: string;
    assistantId?: string;
}

async function startAnalysisSequence(params: RunParams) {
    const { jobId, pdfBase64, filename, hash, jobService, openaiKey, assistantId } = params;
    let aiService: OpenAIService | null = null;

    try {
        aiService = new OpenAIService({
            apiKey: openaiKey || '',
            assistantId: assistantId || '',
            maxRetries: 5
        });

        // Step 1: Upload
        await jobService.updateProgress(jobId, 'upload', 'Subiendo documento...', filename, hash);
        const fileId = await aiService.uploadFile(pdfBase64, filename || 'doc.pdf');

        // Step 2: Indexing
        await jobService.updateProgress(jobId, 'indexing', 'Creando índice...');
        const vsName = `Licitacion-${new Date().getFullYear()}-${hash.substring(0, 8)}`;
        const vectorStoreId = await aiService.createVectorStore(vsName, fileId);
        await aiService.waitForVectorStore(vectorStoreId, fileId);

        // Step 3: Start Run (Non-Blocking)
        await jobService.updateProgress(jobId, 'analyzing', 'IA Iniciada. Procesamiento en segundo plano...');
        const instruction = `Analiza el documento legal adjunto (Pliego). Extrae los datos siguiendo estrictamente el esquema JSON definido.
            
            IMPORTANTE: Si no encuentras información o el documento parece vacío, NO termines sin responder. Devuelve el JSON con valores vacíos o nulos, pero SIEMPRE devuelve un JSON válido.`;

        const { threadId, runId } = await aiService.startRun(vectorStoreId, instruction);

        // Step 4: SAVE METADATA (Critical for Sync)
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

        console.log(`[Startup] Job ${jobId} started successfully. Run: ${runId}`);

    } catch (error: any) {
        await jobService.failJob(jobId, error.message);
        // If we fail here, we should cleanup if possible, but simplest is just fail.
    }
}
