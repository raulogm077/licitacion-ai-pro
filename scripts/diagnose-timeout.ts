/**
 * Diagnostic Script: Test OpenAI Runner Flow
 * 
 * Purpose: Verify if the timeout is from:
 * 1. Frontend not reaching backend
 * 2. Backend not responding to sync
 * 3. OpenAI actually taking too long
 * 
 * Run: npx tsx scripts/diagnose-timeout.ts
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function diagnose() {
    console.log("🔍 Diagnostic: OpenAI Runner Timeout Investigation\n");

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Authenticate
    console.log("🔐 Step 1: Authenticating...");
    const email = `diagnostic.${Date.now()}@test.com`;
    const password = 'TestDiagnostic123!';

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError || !authData.user) {
        console.error("❌ Auth failed:", authError?.message);
        process.exit(1);
    }

    console.log(`✅ Authenticated as ${email}`);

    // 2. Prepare small test file
    console.log("\n📄 Step 2: Loading test PDF...");
    const testFile = path.resolve(process.cwd(), 'guia_lectura.pdf');

    if (!fs.existsSync(testFile)) {
        console.error("❌ Test file not found:", testFile);
        console.log("💡 Please create a small PDF (< 1MB) named 'guia_lectura.pdf' in the project root");
        process.exit(1);
    }

    const fileBuffer = fs.readFileSync(testFile);
    const pdfBase64 = fileBuffer.toString('base64');
    const hash = `diag-${Date.now()}`;

    console.log(`✅ Loaded ${(fileBuffer.length / 1024).toFixed(2)} KB`);

    // 3. Start Job
    console.log("\n🚀 Step 3: Starting job (action: start)...");
    const startTime = Date.now();

    const { data: startData, error: startError } = await supabase.functions.invoke('openai-runner', {
        body: {
            pdfBase64,
            filename: 'guia_lectura.pdf',
            hash,
            action: 'start'
        }
    });

    if (startError) {
        console.error("❌ Start failed:", startError);
        process.exit(1);
    }

    const jobId = startData.jobId;
    console.log(`✅ Job started: ${jobId} (took ${Date.now() - startTime}ms)`);

    // 4. Poll with detailed logging
    console.log("\n👀 Step 4: Polling job status (max 10 minutes)...\n");

    const MAX_ITERATIONS = 20; // 20 * 30s = 10 minutes
    const POLL_INTERVAL = 30000; // 30s
    let iteration = 0;

    while (iteration < MAX_ITERATIONS) {
        iteration++;
        const elapsed = Date.now() - startTime;

        // Read DB
        const { data: job, error: jobError } = await supabase
            .from('analysis_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (jobError) {
            console.error("❌ Poll error:", jobError);
            break;
        }

        console.log(`[${Math.floor(elapsed / 1000)}s] Status: ${job.status} | Step: ${job.metadata?.step} | Msg: ${job.metadata?.message || 'none'}`);

        // Check completion
        if (job.status === 'completed') {
            console.log("\n✅ JOB COMPLETED!");
            console.log("Result keys:", Object.keys(job.result || {}));
            console.log(`Total time: ${Math.floor(elapsed / 1000)}s`);
            return;
        }

        if (job.status === 'failed') {
            console.error("\n❌ JOB FAILED:", job.error);
            return;
        }

        // Trigger sync
        if (job.status === 'processing') {
            console.log(`  🔄 Triggering sync...`);
            const syncStart = Date.now();

            const { data: syncData, error: syncError } = await supabase.functions.invoke('openai-runner', {
                body: { action: 'sync', jobId }
            });

            const syncDuration = Date.now() - syncStart;

            if (syncError) {
                console.error(`  ⚠️ Sync error (${syncDuration}ms):`, syncError);
            } else {
                console.log(`  ✅ Sync response (${syncDuration}ms):`, JSON.stringify(syncData));
            }
        }

        // Wait
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }

    console.log("\n⏱️ TIMEOUT: Job did not complete within 10 minutes");
    console.log("This suggests either:");
    console.log("1. OpenAI is taking longer than expected (check OpenAI dashboard)");
    console.log("2. Backend is stuck in a loop (check Supabase Edge Function logs)");
    console.log("3. Background task failed silently (check job.metadata for clues)");
}

diagnose().catch(console.error);
