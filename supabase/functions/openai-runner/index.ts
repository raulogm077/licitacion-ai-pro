/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import OpenAI from "npm:openai@^4.0.0";
// import { LicitacionContentSchema } from "./_shared/schemas.ts";

/**
 * Supabase Edge Function: openai-runner
 * 
 * Replaces the Vercel API endpoint to avoid 60s timeout.
 * Uses 'EdgeRuntime.waitUntil' to perform long-running OpenAI tasks in the background.
 */

// CORS Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    console.log(`[ENTRY] Request received: ${req.method} ${req.url}`);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Validation & Auth
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing Authorization header');
        }

        // Initialize Supabase Client (Service Role for Admin Access needed for internal tasks? 
        // Actually, we use the user's token for RLS context, but we might need Service Role for updating jobs reliably if user disconnects?
        // Let's use Service Role for the background worker to ensure permissions, 
        // but validate the user first.

        // Auth context from request
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            console.error('Auth Check Failed:', userError);
            return new Response(JSON.stringify({ error: 'Internal Auth Failed', details: userError }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Admin client for background worker (bypasses RLS for updates)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 2. Parse Body
        const { pdfBase64, filename, hash } = await req.json();

        if (!pdfBase64) throw new Error('Missing pdfBase64');
        if (!hash) throw new Error('Missing hash');

        // 3. Create Job in DB
        const { data: job, error: jobError } = await supabaseAdmin
            .from('analysis_jobs')
            .insert({
                user_id: user.id,
                status: 'pending',
                metadata: {
                    step: 'init',
                    message: 'Iniciando análisis...',
                    filename: filename || 'documento.pdf',
                    hash: hash
                }
            })
            .select('id')
            .single();

        if (jobError) throw new Error(`Failed to create job: ${jobError.message}`);
        const jobId = job.id;

        console.log(`[Job ${jobId}] Created. Starting background processing...`);

        // 4. Start Background Process (waitUntil)
        // IMPORTANT: formatting processAnalysis as a promise chain or async IIFE
        const backgroundTask = processAnalysis({
            jobId,
            pdfBase64,
            filename,
            hash,
            openaiKey: Deno.env.get('OPENAI_API_KEY'),
            assistantId: Deno.env.get('VITE_OPENAI_ASSISTANT_ID') ?? Deno.env.get('OPENAI_ASSISTANT_ID'),
            supabaseAdmin
        });

        // Fire and forget (but wait until runtime permits)
        EdgeRuntime.waitUntil(backgroundTask);

        // 5. Return Success immediately
        return new Response(
            JSON.stringify({ jobId, status: 'started' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
        );

    } catch (error) {
        console.error('Error in request handler:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});

// --- Background Worker Logic ---

interface ProcessParams {
    jobId: string;
    pdfBase64: string;
    filename?: string;
    hash: string;
    openaiKey?: string;
    assistantId?: string;
    supabaseAdmin: any;
}

async function processAnalysis({ jobId, pdfBase64, filename, hash, openaiKey, assistantId, supabaseAdmin }: ProcessParams) {
    // Helper to update progress
    const updateProgress = async (state: string, message: string) => {
        console.log(`[Job ${jobId}] ${state}: ${message}`);
        await supabaseAdmin.from('analysis_jobs').update({
            status: 'processing',
            metadata: { step: state, message, filename, hash },
            updated_at: new Date().toISOString()
        }).eq('id', jobId);
    };

    let vectorStoreId: string | undefined;
    let fileId: string | undefined;

    try {
        if (!openaiKey) throw new Error('Misconfigured: OPENAI_API_KEY is missing');
        if (!assistantId) throw new Error('Misconfigured: OPENAI_ASSISTANT_ID is missing');

        const openai = new OpenAI({ apiKey: openaiKey, maxRetries: 3 });

        // Step 1: Upload
        await updateProgress('upload', 'Subiendo documento a OpenAI...');
        const pdfBuffer = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

        // Deno specific: File object creation
        const file = new File([pdfBuffer], filename || 'pliego.pdf', { type: 'application/pdf' });

        const uploadedFile = await openai.files.create({
            file: file,
            purpose: 'assistants'
        });
        fileId = uploadedFile.id;

        // Step 2: Vector Store
        await updateProgress('indexing', 'Creando índice vectorial...');
        const vsName = `Licitacion-${new Date().getFullYear()}-${hash.substring(0, 8)}`;

        const vectorStore = await openai.beta.vectorStores.create({
            name: vsName,
            expires_after: { anchor: 'last_active_at', days: 1 }
        });
        vectorStoreId = vectorStore.id;

        await openai.beta.vectorStores.files.create(vectorStoreId, {
            file_id: fileId
        });

        // Step 3: Wait for Indexing
        await updateProgress('indexing', 'Procesando archivo para búsqueda (esto puede tardar unos segundos)...');

        let status = 'in_progress';
        while (status !== 'completed' && status !== 'failed') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const vs = await openai.beta.vectorStores.retrieve(vectorStoreId);
            status = vs.status;
            if (status === 'in_progress') {
                const f = await openai.beta.vectorStores.files.retrieve(vectorStoreId, fileId!);
                if (f.status === 'failed') status = 'failed';
            }
        }

        if (status === 'failed') throw new Error('OpenAI falló al procesar el archivo PDF.');

        // Step 4: Run Assistant
        await updateProgress('analyzing', 'IA analizando el documento...');

        const thread = await openai.beta.threads.create({
            tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
            messages: [{
                role: "user",
                content: "Analiza el documento legal adjunto (Pliego). Extrae los datos siguiendo estrictamente el esquema JSON definido."
            }]
        });

        const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
            assistant_id: assistantId,
        });

        if (run.status !== 'completed') {
            throw new Error(`El análisis falló: ${run.last_error?.code || run.status}`);
        }

        // Step 5: Get Result
        await updateProgress('map', 'Procesando respuesta...');
        const messages = await openai.beta.threads.messages.list(thread.id);
        const lastMessage = messages.data[0];

        if (lastMessage.role === 'assistant' && lastMessage.content[0].type === 'text') {
            const rawJson = lastMessage.content[0].text.value;
            let finalResult;

            // Cleanup Markdown
            const cleanedText = rawJson.replace(/```json\n([\s\S]*?)\n```/s, '$1').replace(/```([\s\S]*?)```/s, '$1');

            try {
                finalResult = JSON.parse(cleanedText);
            } catch (e) {
                console.error("Failed to parse JSON", rawJson);
                throw new Error("La IA no devolvió un JSON válido");
            }

            // Step 6: Complete
            await supabaseAdmin.from('analysis_jobs').update({
                status: 'completed',
                result: finalResult,
                metadata: { step: 'done', message: 'Análisis completado', filename, hash },
                updated_at: new Date().toISOString()
            }).eq('id', jobId);

            console.log(`[Job ${jobId}] Completed Successfully`);

        } else {
            throw new Error('Respuesta inesperada de OpenAI');
        }

    } catch (error) {
        console.error(`[Job ${jobId}] Failed:`, error);
        await supabaseAdmin.from('analysis_jobs').update({
            status: 'failed',
            error: error.message,
            metadata: { step: 'error', message: 'Fallo el análisis' },
            updated_at: new Date().toISOString()
        }).eq('id', jobId);

    } finally {
        // Cleanup OpenAI Resources
        if (vectorStoreId && openaiKey) {
            try { const openai = new OpenAI({ apiKey: openaiKey }); await openai.beta.vectorStores.del(vectorStoreId); } catch { /* ignore */ }
        }
        if (fileId && openaiKey) {
            try { const openai = new OpenAI({ apiKey: openaiKey }); await openai.files.del(fileId); } catch { /* ignore */ }
        }
    }
}
