
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { runWorkflow } from '../api/_lib/openaiWorkflow/runner';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    console.log('--- Testing OpenAI Runner (Real Integration) ---');

    // 1. Validate Config
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) { console.error('MISSING: OPENAI_API_KEY'); return; }

    // 2. Read PDF
    const pdfPath = path.resolve(process.cwd(), 'memo_p2.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error(`[File] PDF not found at: ${pdfPath}`);
        return;
    }
    console.log(`[File] Reading ${pdfPath}...`);
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');


    // 3. Run Workflow
    try {
        console.log('Initiating workflow...');
        const startTime = Date.now();

        const result = await runWorkflow({
            pdfBase64: pdfBase64,
            readingMode: 'full',
            hash: 'test-real-' + Date.now(),
            userId: 'test-user-id', // Dummy ID
            filename: 'memo_p2.pdf'
        }, {
            onProgress: (stage, msg) => console.log(`[${stage}] ${msg}`)
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Workflow Completed in ${duration}s!`);
        console.log('Result Preview:');
        console.log(JSON.stringify(result, null, 2).substring(0, 1000) + '...');

    } catch (error) {
        console.error('Workflow Failed:', error);
    }
}

main();
