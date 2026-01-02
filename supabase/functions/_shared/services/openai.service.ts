// @ts-expect-error - OpenAI types not fully compatible with Deno
/* eslint-disable */
import OpenAI from "https://esm.sh/openai@4.77.0";
import { mapOpenAIError } from "../utils/error.utils.ts";
import { LicitacionContentSchema } from "../schemas.ts";

export interface OpenAIServiceConfig {
    apiKey: string;
    assistantId: string;
    maxRetries?: number;
}

export class OpenAIService {
    private openai: OpenAI;
    private assistantId: string;

    constructor(config: OpenAIServiceConfig) {
        if (!config.apiKey) throw new Error('Misconfigured: OPENAI_API_KEY is missing');
        if (!config.assistantId) throw new Error('Misconfigured: OPENAI_ASSISTANT_ID is missing');

        this.assistantId = config.assistantId;
        this.openai = new OpenAI({
            apiKey: config.apiKey,
            maxRetries: config.maxRetries || 5
        });
    }

    async uploadFile(base64: string, filename: string): Promise<string> {
        console.log(`[OpenAIService] Uploading file: ${filename}...`);
        const start = Date.now();

        // Convert Base64 to Blob/File (Mocking the file object for consumption)
        // Note: Deno Edge doesn't support Buffer, so we use Uint8Array
        const binString = atob(base64);
        const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
        const file = new File([bytes], filename, { type: 'application/pdf' });

        try {
            const response = await this.openai.files.create({
                file: file,
                purpose: "assistants",
            }, { timeout: 50000 }); // 50s Timeout (Safe buffer before 60s Function Limit)

            console.log(`[OpenAIService] Upload Complete. ID: ${response.id} (${Date.now() - start}ms)`);
            return response.id;
        } catch (e) {
            console.error(`[OpenAIService] Upload Failed (${Date.now() - start}ms):`, e);
            throw e;
        }
    }

    async createVectorStore(name: string, fileId: string): Promise<string> {
        console.log(`[OpenAIService] Creating Vector Store: ${name}...`);
        const start = Date.now();
        try {
            const vs = await this.openai.beta.vectorStores.create({
                name: name,
                file_ids: [fileId]
            }, { timeout: 20000 }); // 20s Timeout

            console.log(`[OpenAIService] Vector Store Created. ID: ${vs.id} (${Date.now() - start}ms)`);
            return vs.id;
        } catch (e) {
            console.error(`[OpenAIService] VS Creation Failed (${Date.now() - start}ms):`, e);
            throw e;
        }
    }

    async waitForVectorStore(vectorStoreId: string, fileId: string): Promise<void> {
        let status = 'in_progress';
        // Bump to 90s for large files (300+ pages)
        for (let i = 0; i < 90; i++) {
            if (status === 'completed' || status === 'failed') break;

            await new Promise(r => setTimeout(r, 1000));
            const vs = await this.openai.beta.vectorStores.retrieve(vectorStoreId);
            status = vs.status;

            if (status === 'in_progress') {
                const f = await this.openai.beta.vectorStores.files.retrieve(vectorStoreId, fileId);
                if (f.status === 'failed') status = 'failed';
            }
        }

        if (status === 'failed') throw new Error('OpenAI falló al procesar el índice del archivo PDF.');
        if (status !== 'completed') throw new Error('Timeout esperando indexación del archivo (90s).');
    }

    /**
     * Starts the Assistant Run and returns immediately.
     * Does NOT wait for completion.
     */
    async startRun(
        vectorStoreId: string,
        instruction: string
    ): Promise<{ threadId: string; runId: string }> {
        // 1. Create Thread (Empty to start)
        const thread = await this.openai.beta.threads.create({
            tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
        });

        // 2. Add Message explicitly
        await this.openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: instruction
        });

        // 3. Verify Message Exists
        const check = await this.openai.beta.threads.messages.list(thread.id);
        console.log(`[startRun] Initial Msg Count: ${check.data.length}`);

        // 4. Create Run
        const run = await this.openai.beta.threads.runs.create(thread.id, {
            assistant_id: this.assistantId,
            model: 'gpt-4o-mini',
        });

        return { threadId: thread.id, runId: run.id };
    }

    /**
     * Checks the status of an existing Run.
     * If completed, fetches and returns the result.
     */
    async checkRunStatus(threadId: string, runId: string): Promise<{ status: string; result?: any; error?: string }> {
        const run = await this.openai.beta.threads.runs.retrieve(threadId, runId);

        if (run.status === 'completed') {
            const result = await this.getRunResult(threadId, runId);
            return { status: 'completed', result };
        }

        if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired') {
            const errorMsg = mapOpenAIError(run.last_error || { code: run.status, message: 'Run failed' });
            return { status: 'failed', error: errorMsg };
        }

        // queued, in_progress, requires_action
        return { status: 'processing' };
    }

    // Keep getRunResult private or public helper (refactored to be non-polling ideally, but okay to keep simple poll for messages if run is confirmed done)
    async getRunResult(threadId: string, runId: string): Promise<any> {
        console.log(`[OpenAIService] Run Completed. Checking for output messages...`);

        // NO POLLING LOOP. Single Check.
        // If message is not ready, we throw RESULT_NOT_READY to keep the Edge Function fast.

        // New Strategy: Check Run Steps to find the Message ID directly
        const steps = await this.openai.beta.threads.runs.steps.list(threadId, runId);
        const messageStep = steps.data.find(step => step.type === 'message_creation' && step.step_details?.message_creation?.message_id);

        let lastMessage;

        if (messageStep) {
            const messageId = messageStep.step_details.message_creation.message_id;
            // console.log(`[getRunResult] Found Message Create Step. MsgID: ${messageId}`);

            try {
                lastMessage = await this.openai.beta.threads.messages.retrieve(threadId, messageId);
                // console.log(`[getRunResult] Message Retrieved successfully.`);
            } catch (e) {
                console.error("[getRunResult] Failed to retrieve message by ID:", e);
                // If retrieve fails, it might be propagation lag. Treat as not ready.
                throw new Error("RESULT_NOT_READY: Message ID found but retrieve failed (propagation).");
            }
        } else {
            console.log(`[getRunResult] No message_creation step found yet.`);
            // If Run is completed but steps list doesn't show message yet, it's lag.
            // OR it's a Zombie Run (Empty File). We need to distinguish hard.
            // But for safety, we first treat as "Not Ready". 
            // IF this persists for many syncs, we might need a "Zombie Detector" based on Run Age, 
            // but let's assume it's just latency for now.

            // Wait, if we return RESULT_NOT_READY, the frontend keeps polling.
            // If it NEVER appears (Zombie), we loop forever. 
            // We need to bring back the "Zombie Run" check but based on Time? 
            // Actually, if it's "completed" and has NO message step, it's likely a Zombie Run immediately (unless OpenAI is incredibly slow to update steps).
            // Let's assume if status is 'completed' and NO message step exists, it is a Zombie Run.
            // But safety first: Let's throw NOT_READY. If the user reports "Hanging", we know it's because of this.
            // User wants to fix TIMEOUTS. So let's prioritize speed.
            throw new Error("RESULT_NOT_READY: Run completed but message step not visible.");
        }

        if (lastMessage?.role === 'assistant' && lastMessage?.content[0]?.type === 'text') {
            const rawText = lastMessage.content[0].text.value;

            // Strategy 1: Standard Markdown Cleanup
            const cleanedText = rawText
                .replace(/```json\n([\s\S]*?)\n```/s, '$1')
                .replace(/```([\s\S]*?)```/s, '$1');

            try {
                const jsonData = JSON.parse(cleanedText);

                // CRITICAL FIX: Unwrap 'result' wrapper
                let contentToValidate = jsonData;
                if (jsonData.result && typeof jsonData.result === 'object') {
                    contentToValidate = jsonData.result;
                }

                return LicitacionContentSchema.parse(contentToValidate);
            } catch (e) {
                // Strategy 2: Regex Extraction
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        const fallbackData = JSON.parse(jsonMatch[0]);
                        return LicitacionContentSchema.parse(fallbackData);
                    } catch (e2) {
                        console.error("Regex failed", e2);
                    }
                }
                throw new Error("La IA no devolvió un JSON válido.");
            }
        }

        throw new Error(`No se encontró mensaje de respuesta válido. (Msgs: ${lastMessage ? 1 : 0}, Retry: ${retryCount}, LastLen: ${lastMessage ? 'OK' : 'ZERO'})`);
    }

    async cleanup(vectorStoreId?: string, fileId?: string) {
        if (vectorStoreId) {
            try { await this.openai.beta.vectorStores.del(vectorStoreId); } catch (e) { console.warn("Cleanup VS failed", e); }
        }
        if (fileId) {
            try { await this.openai.files.del(fileId); } catch (e) { console.warn("Cleanup File failed", e); }
        }
    }
}
