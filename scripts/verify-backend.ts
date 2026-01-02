
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env
dotenv.config();

async function main() {
    console.log("🚀 Starting Backend Verification...");

    // Use Anon Key available in .env
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Authenticate (Simulate Frontend)
    console.log("🔐 Authenticating test user...");
    const email = `test.backend.${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    // Try sign up
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
    });

    if (authError) {
        console.error("❌ Auth Failed:", authError.message);
        process.exit(1);
    }

    const user = authData.user;
    if (!user) {
        console.error("❌ User creation failed (maybe confirm email needed?)");
        // Try checking if we got a session anyway (Supabase sometimes auto-signs in)
    }

    console.log(`✅ Authenticated as ${email} (${user?.id})`);

    // 2. Prepare File
    const filePath = path.resolve(process.cwd(), 'guia_lectura.pdf');
    if (!fs.existsSync(filePath)) {
        console.error("❌ File not found:", filePath);
        process.exit(1);
    }
    const fileBuffer = fs.readFileSync(filePath);
    const pdfBase64 = fileBuffer.toString('base64');
    const hash = `test-verify-${Date.now()}`;

    // 2. Invoke Function
    console.log("📡 Invoking openai-runner...");
    const { data, error } = await supabase.functions.invoke('openai-runner', {
        body: {
            pdfBase64,
            filename: 'guia_lectura.pdf',
            hash: hash
        }
    });

    if (error) {
        console.error("❌ Invoke Error:", error);
        process.exit(1);
    }

    console.log("✅ Function Invoked. Job ID:", data.jobId);
    const jobId = data.jobId;

    // 3. Poll DB for Progress (Heartbeat Check)
    console.log("👀 Polling DB for updates...");

    let lastMsg = '';
    const startTime = Date.now();

    while (attempts < maxAttempts) {
        const { data: job, error: jobError } = await supabase
            .from('analysis_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (jobError) {
            console.error("❌ Poll Error:", jobError);
            break;
        }

        const msg = `[${job.status}] ${job.metadata?.step || 'init'}: ${job.metadata?.message || ''}`;
        if (msg !== lastMsg) {
            console.log(`⏱️ ${(Date.now() - startTime) / 1000}s: ${msg}`);
            lastMsg = msg;
        }

        if (job.status === 'completed') {
            console.log("🎉 Analysis COMPLETED!");
            console.log("Result Keys:", Object.keys(job.result || {}));
            break;
        }

        if (job.status === 'failed') {
            console.error("❌ Analysis FAILED:", job.error);
            break;
        }

        // Wait 2s
        await new Promise(r => setTimeout(r, 2000));
    }
}

main();
