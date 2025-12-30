
import "dotenv/config";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

// Load environment variables (support .env.local)
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const GUIDE_FILENAME = "guia_lectura.pdf"; // Expected filename in root or docs/
const GUIDE_VS_NAME = "Base de Conocimiento Antigravity";

async function main() {
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    const assistantId = process.env.VITE_OPENAI_ASSISTANT_ID;

    if (!apiKey) {
        console.error("❌ Error: OPENAI_API_KEY is missing.");
        process.exit(1);
    }
    if (!assistantId) {
        console.error("❌ Error: VITE_OPENAI_ASSISTANT_ID is missing. Run setup-assistant.ts first.");
        process.exit(1);
    }

    const openai = new OpenAI({ apiKey });

    // 1. Locate the Guide PDF
    const possiblePaths = [
        path.join(process.cwd(), GUIDE_FILENAME),
        path.join(process.cwd(), "docs", GUIDE_FILENAME),
        path.join(process.cwd(), "Guia_Lectura.pdf"), // Alternative name
    ];

    const guidePath = possiblePaths.find(p => fs.existsSync(p));

    if (!guidePath) {
        console.error(`❌ Error: Could not find Guide PDF. Expected at: ${GUIDE_FILENAME} or docs/${GUIDE_FILENAME}`);
        process.exit(1);
    }

    console.log(`found Guide at: ${guidePath}`);

    try {
        // 2. Upload File to OpenAI
        console.log("📤 Uploading Guide PDF...");
        const file = await openai.files.create({
            file: fs.createReadStream(guidePath),
            purpose: "assistants",
        });
        console.log(`   File ID: ${file.id}`);

        // 3. Create Vector Store for the Guide
        console.log("📚 Creating Vector Store...");
        const vectorStore = await openai.beta.vectorStores.create({
            name: GUIDE_VS_NAME,
        });
        console.log(`   Vector Store ID: ${vectorStore.id}`);

        // 4. Attach File to Vector Store
        console.log("🔗 Attaching file to Vector Store...");
        await openai.beta.vectorStores.files.create(vectorStore.id, {
            file_id: file.id,
        });

        // Wait for processing (optional but good practice to check)
        // For a single file, we can just proceed or poll briefly.

        // 5. Update Assistant to use this Vector Store
        console.log(`🤖 Updating Assistant (${assistantId}) with new Vector Store...`);

        await openai.beta.assistants.update(assistantId, {
            tool_resources: {
                file_search: {
                    vector_store_ids: [vectorStore.id],
                },
            },
        });

        console.log("\n✅ Guide Upload and Association Complete!");
        console.log("---------------------------------------");
        console.log(`GUIDE_VS_ID: ${vectorStore.id}`);
        console.log("---------------------------------------");
        console.log("Please save this VS ID if you need to reference it manually, though it's now attached to the assistant.");

    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

main();
