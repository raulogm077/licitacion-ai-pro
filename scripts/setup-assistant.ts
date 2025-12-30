
import "dotenv/config";
import dotenv from "dotenv";
import OpenAI from "openai";
import { ANALISTA_V2_CONFIG } from "../src/config/analista-v2.config";

// Try loading .env.local if available (overrides .env)
dotenv.config({ path: ".env.local" });

async function main() {
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
        console.error("❌ Error: OPENAI_API_KEY (or VITE_OPENAI_API_KEY) is not set in environment variables.");
        process.exit(1);
    }

    const openai = new OpenAI({ apiKey });

    console.log("🚀 Creating Assistant: " + ANALISTA_V2_CONFIG.name);
    console.log("Model: " + ANALISTA_V2_CONFIG.model);

    try {
        const assistant = await openai.beta.assistants.create({
            name: ANALISTA_V2_CONFIG.name,
            model: ANALISTA_V2_CONFIG.model,
            instructions: ANALISTA_V2_CONFIG.instructions,
            tools: [{ type: "file_search" }],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            response_format: ANALISTA_V2_CONFIG.response_format as any, // Type cast might be needed depending on SDK version
        });

        console.log("\n✅ Assistant Created Successfully!");
        console.log("-----------------------------------");
        console.log(`🆔 Assistant ID: ${assistant.id}`);
        console.log("-----------------------------------");
        console.log("\nPlease add this ID to your .env file as VITE_OPENAI_ASSISTANT_ID (or similar) depending on your setup.");

    } catch (error) {
        console.error("❌ Error creating assistant:", error);
        process.exit(1);
    }
}

main();
