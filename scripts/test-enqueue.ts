/**
 * Test Script: Queue Enqueue
 * 
 * Purpose: Test the new async architecture by enqueueing a job
 * 
 * Run: npx tsx scripts/test-enqueue.ts
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function testEnqueue() {
    console.log("🧪 Testing Async Queue Architecture\n");

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Authenticate
    console.log("🔐 Step 1: Authenticating...");
    const email = `test.queue.${Date.now()}@test.com`;
    const password = 'TestQueue123!';

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError || !authData.user) {
        console.error("❌ Auth failed:", authError?.message);
        process.exit(1);
    }

    console.log(`✅ Authenticated as ${email}\n`);

    // 2. Prepare test file
    console.log("📄 Step 2: Loading test PDF...");
    const testFile = path.resolve(process.cwd(), 'memo_p2.pdf');

    if (!fs.existsSync(testFile)) {
        console.error("❌ Test file not found:", testFile);
        process.exit(1);
    }

    const fileBuffer = fs.readFileSync(testFile);
    const pdfBase64 = fileBuffer.toString('base64');
    const hash = `test-queue-${Date.now()}`;

    console.log(`✅ Loaded ${(fileBuffer.length / 1024).toFixed(2)} KB\n`);

    // 3. Enqueue job (via openai-runner)
    console.log("🚀 Step 3: Enqueueing job...");
    const startTime = Date.now();

    const { data: startData, error: startError } = await supabase.functions.invoke('open ai-runner', {
        body: {
            pdfBase64,
            filename: 'memo_p2.pdf',
            hash,
            action: 'start'
        }
    });

    if (startError) {
        console.error("❌ Enqueue failed:", startError);
        process.exit(1);
    }

    const jobId = startData.jobId;
    const elapsed = Date.now() - startTime;
    console.log(`✅ Job enqueued: ${jobId} (took ${elapsed}ms)\n`);

    // 4. Verify job in DB
    console.log("📊 Step 4: Verifying job in DB...");
    const { data: job, error: jobError } = await supabase
        .from('analysis_jobs')
        .select('id, status, metadata')
        .eq('id', jobId)
        .single();

    if (jobError || !job) {
        console.error("❌ Job not found:", jobError);
        process.exit(1);
    }

    console.log(`✅ Job found in DB`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Step: ${job.metadata?.step || 'N/A'}\n`);

    // 5. Check queue (using admin/service role in real scenario)
    console.log("📥 Step 5: Polling job status...\n");

    let pollCount = 0;
    const MAX_POLLS = 20; // 20 * 30s = 10 minutes
    const POLL_INTERVAL = 30000; // 30s

    while (pollCount < MAX_POLLS) {
        pollCount++;
        const pollElapsed = Date.now() - startTime;

        const { data: currentJob } = await supabase
            .from('analysis_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (!currentJob) break;

        console.log(`[${Math.floor(pollElapsed / 1000)}s] Status: ${currentJob.status} | Step: ${currentJob.metadata?.step} | Msg: ${currentJob.metadata?.message || 'none'}`);

        if (currentJob.status === 'completed') {
            console.log("\n✅ JOB COMPLETED!");
            console.log("Result keys:", Object.keys(currentJob.result || {}));
            console.log(`Total time: ${Math.floor(pollElapsed / 1000)}s`);
            return;
        }

        if (currentJob.status === 'failed') {
            console.error("\n❌ JOB FAILED:", currentJob.error);
            return;
        }

        await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }

    console.log("\n⏱️ TIMEOUT: Job did not complete within 10 minutes");
    console.log("Check:\n1. pg_cron jobs are running\n2. queue-processor is deployed\n3. Supabase Edge Function logs");
}

testEnqueue().catch(console.error);
