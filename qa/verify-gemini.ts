
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';

// Polyfill fetch
// @ts-ignore
if (!global.fetch) {
    // @ts-ignore
    global.fetch = fetch;
}

// Read API Key
function getApiKey() {
    let key = process.env.VITE_GEMINI_API_KEY;
    if (!key) {
        try {
            const envPath = path.resolve(process.cwd(), '.env');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf-8');
                const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
                if (match) {
                    key = match[1].trim();
                }
            }
        } catch (e) {
            console.warn("Could not read .env file locally");
        }
    }
    return key;
}

async function runTest() {
    const API_KEY = getApiKey();
    if (!API_KEY) {
        console.error("❌ CRITICAL: No API Key found.");
        process.exit(1);
    }
    console.log("✅ API Key detected:", API_KEY.slice(-4));

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    // Generate a dummy PDF if not exists
    const pdfPath = "test-pliego.pdf";
    if (!fs.existsSync(pdfPath)) {
        console.log("Generating dummy PDF for test...");
        fs.writeFileSync(pdfPath, Buffer.from("%PDF-1.4\n%µµµµ\n"));
    }

    console.log("📖 Leyendo PDF...");
    const fileBuffer = fs.readFileSync(pdfPath);
    const base64Content = fileBuffer.toString('base64');
    console.log(`✅ PDF leído. Bytes: ${fileBuffer.length}`);

    const prompt = "Extract the budget and title from this document. Return JSON. If you find lists, return them as strings or objects, I can handle both.";

    console.log("🤖 Enviando a Gemini (gemini-flash-latest)...");

    try {
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Content,
                    mimeType: "application/pdf",
                },
            },
        ]);

        console.log("✅ generateContent completado.");
        const response = await result.response;
        const text = response.text();
        console.log("📜 Texto extraído:", text.substring(0, 150) + "...");

        if (text) {
            console.log("✅ TEST PASSED: El modelo generó texto correctamente.");
        } else {
            console.error("❌ TEST FAILED: El modelo no generó texto.");
        }

    } catch (e: any) {
        console.error("❌ EXCEPTION:", e);
    }
}

runTest();
