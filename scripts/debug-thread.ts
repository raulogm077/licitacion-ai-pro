
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("Missing API Key");

const client = new OpenAI({ apiKey });

// Job ID from the last run: f1855e38-c7cb-43ef-9250-9511346a0b55
// I need the Thread ID. I will query the DB first to get it.

// import { createClient } from '@supabase/supabase-js';
async function run() {
    // Hardcoded from Error Message
    const threadId = 'thread_SCG6H1AlPHHhczKLmrQCiMXG';

    // 2. List Messages
    console.log(`Fetching messages from OpenAI for Thread: ${threadId}`);
    try {
        const messages = await client.beta.threads.messages.list(threadId);
        console.log(`Msg Count: ${messages.data.length}`);
        messages.data.forEach(m => {
            console.log(` - [${m.role}] (${m.run_id}): ${JSON.stringify(m.content[0])}`);
        });

        // 3. List Runs & Steps
        const runs = await client.beta.threads.runs.list(threadId);
        const lastRun = runs.data[0];
        if (lastRun) {
            console.log(`Last Run: ${lastRun.id} Status: ${lastRun.status}`);
            const steps = await client.beta.threads.runs.steps.list(threadId, lastRun.id);
            console.log(`Steps Count: ${steps.data.length}`);
            steps.data.forEach(s => {
                console.log(` - Step ${s.id} Type: ${s.type}`);
                if (s.step_details.type === 'message_creation') {
                    console.log(`   -> Msg ID: ${s.step_details.message_creation.message_id}`);
                }
            });
        }

    } catch (e) {
        console.error("OpenAI Error:", e);
    }
}

run();
