
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { runWorkflow } from '../src/server/openaiWorkflow/runner';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    console.log('--- Testing OpenAI Runner (Real Integration) ---');

    // 1. Validate Config
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!apiKey) { console.error('MISSING: OPENAI_API_KEY'); return; }
    if (!supabaseUrl || !supabaseKey) { console.error('MISSING: SUPABASE URL/KEY'); return; }

    // 2. Authenticate User
    console.log('[Auth] Logging in as raulogm07@hotmail.com...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: 'raulogm07@hotmail.com',
        password: 'test1a'
    });

    if (authError || !user) {
        console.error('[Auth] Login Failed:', authError?.message);
        return;
    }
    console.log('[Auth] Success. User ID:', user.id);

    // 3. Read PDF
    const pdfPath = path.resolve(process.cwd(), 'memo_p2.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error(`[File] PDF not found at: ${pdfPath}`);
        return;
    }
    console.log(`[File] Reading ${pdfPath}...`);
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');


    // 4. Run Workflow
    try {
        console.log('Initiating workflow...');
        const startTime = Date.now();

        const result = await runWorkflow({
            pdfBase64: pdfBase64,
            readingMode: 'full',
            hash: 'test-real-' + Date.now(),
            userId: user.id,
            filename: 'memo_p2.pdf'
        }, {
            onProgress: (stage, msg) => console.log(`[${stage}] ${msg}`)
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Workflow Completed in ${duration}s!`);
        console.log('Result Preview:', JSON.stringify(result, null, 2).substring(0, 500) + '...');

    } catch (error) {
        console.error('Workflow Failed:', error);
    }
}

main();
