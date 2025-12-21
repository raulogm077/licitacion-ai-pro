
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(request: any, response: any) {
    try {
        const apiKey = process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            return response.status(500).json({
                status: 'error',
                message: 'VITE_GEMINI_API_KEY not found in environment variables.'
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const result = await model.generateContent("Say 'Filesystem Check OK' if you receive this.");
        const text = result.response.text();

        return response.status(200).json({
            status: 'success',
            env_check: 'VITE_GEMINI_API_KEY is present',
            model_response: text,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        return response.status(500).json({
            status: 'error',
            message: error.message,
            stack: error.stack
        });
    }
}
