
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !ANON_KEY) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);

// Minimal PDF (Blank page)
import fs from 'fs';

// Load guia_lectura.pdf (Real content, ~380KB)
const PDF_PATH = path.resolve(process.cwd(), 'guia_lectura.pdf');
console.log(`📄 Loading PDF from: ${PDF_PATH}`);
const MINIMAL_PDF_BASE64 = fs.readFileSync(PDF_PATH).toString('base64');
console.log(`📦 PDF Size: ${(MINIMAL_PDF_BASE64.length * 3 / 4 / 1024 / 1024).toFixed(2)} MB`);

async function runTest() {
    console.log("🚀 Starting Async Flow Verification...");

    // 1. Auth as Anon User (REAL WORLD SCENARIO)
    const { data: { session } } = await supabase.auth.signUp({
        email: `test_async_${Date.now()}@example.com`,
        password: 'password123'
    });

    // If user already exists (testing multiple times), sign in
    let token = session?.access_token;
    if (!token) {
        const { data: signIn } = await supabase.auth.signInWithPassword({
            email: `test_async_${Date.now()}@example.com`,
            password: 'password123'
        });
        token = signIn.session?.access_token;
    }

    if (!token) {
        console.error("❌ Auth Failed");
        process.exit(1);
    }

    // Set auth context
    const client = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // 2. TRIGGER START
    console.log("👉 Triggering 'start' action...");
    const { data: startData, error: startError } = await client.functions.invoke('openai-runner', {
        body: {
            action: 'start',
            pdfBase64: MINIMAL_PDF_BASE64,
            filename: 'async_test.pdf',
            hash: `test_hash_${Date.now()}`
        }
    });

    if (startError || !startData?.jobId) {
        console.error("❌ Start Failed:", startError);
        process.exit(1);
    }

    const { jobId } = startData;
    console.log(`✅ Job Started. ID: ${jobId}`);

    // 3. ENTER SYNC LOOP
    console.log("👉 Entering Sync Loop (Every 5s)...");

    let status = 'processing';
    let attempts = 0;
    const MAX_ATTEMPTS = 50; // 250s max for this small test

    while (status === 'processing' && attempts < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;

        console.log(`[${attempts}] Syncing...`);
        const { data: syncData, error: syncError } = await client.functions.invoke('openai-runner', {
            body: {
                action: 'sync',
                jobId: jobId
            }
        });

        if (syncError) {
            console.warn(`⚠️ Sync Transient Error:`, syncError.message);
            continue;
        }

        status = syncData.status;
        console.log(`   Status: ${status}`);

        if (status === 'completed') {
            console.log("✅ JOB COMPLETED!");
            console.log("Result Preview:", JSON.stringify(syncData.result).substring(0, 100) + "...");
            break;
        }

        if (status === 'failed') {
            console.error("❌ JOB FAILED:", syncData.error);
            break;
        }
    }

    if (attempts >= MAX_ATTEMPTS) {
        console.error("❌ TIMEOUT in Test Script");
    }
}

runTest();
