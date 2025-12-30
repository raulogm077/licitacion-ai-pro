
import { Agent, run } from '@openai/agents';
import { OpenAIResponsesModel } from '@openai/agents-openai'; // Import specifically to be safe, or from @openai/agents
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';


// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
if (!apiKey) {
    console.error('Missing OPENAI_API_KEY');
    process.exit(1);
}

const wfId = "wf_695297dea6188190868d94d03ec97d090bc32b21af43e09a";

async function main() {
    console.log('--- Testing Agents SDK with wf_ ID ---');

    const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 3 });

    // Instantiate the Responses Model with the workflow ID
    const responsesModel = new OpenAIResponsesModel(client, wfId);

    // Create the Agent using this model
    // We provide generic instructions because the workflow likely has its own system prompt logic,
    // but the SDK requires this field.
    const agent = new Agent({
        name: "Analista Licitaciones",
        model: responsesModel,
        instructions: "You are an assistant that analyzes legal documents.",
    });

    console.log(`Agent created with model: ${wfId}`);

    // Input for the run
    // Using a simple text input first to verify connectivity
    const input = "Hola, quien eres? Identificate.";

    console.log(`Running agent with input: "${input}"`);

    try {
        const result = await run(agent, input);
        console.log('Run successful!');
        console.log('Final Output:', result.finalOutput);
    } catch (error) {
        console.error('Run failed:', error);
        if (error instanceof Error) {
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
        }
    }
}

main().catch(console.error);
