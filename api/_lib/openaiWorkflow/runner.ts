
/**
 * OpenAI Agent Runner (Agents SDK)
 * 
 * Implements the "Assisted RAG" flow using the Standard OpenAI API:
 * 1. Ingest Document -> Workflow-specific Vector Store
 * 2. Create Thread with the specific Vector Store attached
 * 3. Run existing Assistant (Analista v2) on this Thread
 */

import OpenAI from 'openai';

// Types
export interface WorkflowInput {
    extractedText?: string;
    pdfBase64?: string;
    readingMode: 'full' | 'keydata';
    hash: string;
    userId: string;
    filename?: string;
}

export interface WorkflowOptions {
    signal?: AbortSignal;
    onProgress?: (stage: string, message: string) => void;
}

/**
 * Main Entry Point: Orchestrates the Analysis Workflow via Threads API
 */
export async function runWorkflow(
    input: WorkflowInput,
    options: WorkflowOptions = {}
): Promise<unknown> {
    const { onProgress, signal } = options;

    // Get Keys and IDs
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    const assistantId = process.env.VITE_OPENAI_ASSISTANT_ID;

    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
    if (!assistantId) throw new Error('VITE_OPENAI_ASSISTANT_ID not configured (Assistant not created)');

    const openai = new OpenAI({ apiKey, maxRetries: 3 });

    let vectorStoreId: string | undefined;
    let fileId: string | undefined;

    try {
        // --- Step 1: Document Ingestion (Dynamic Tender) ---
        if (!input.pdfBase64) {
            throw new Error('PDF Content required for analysis');
        }

        onProgress?.('upload', 'Subiendo documento a OpenAI Cloud...');
        const pdfBuffer = Buffer.from(input.pdfBase64, 'base64');

        // Upload File
        const file = await OpenAI.toFile(pdfBuffer, input.filename || 'pliego.pdf', { type: 'application/pdf' });
        const uploadedFile = await openai.files.create({
            file: file,
            purpose: 'assistants'
        });
        fileId = uploadedFile.id;

        if (signal?.aborted) throw new Error('Cancelled');

        // Create Dynamic Vector Store for this specific tender
        // Naming convention: "Licitacion-YYYY-X" (using hash for uniqueness)
        const vsName = `Licitacion-${new Date().getFullYear()}-${input.hash.substring(0, 8)}`;
        onProgress?.('indexing', `Creando índice vectorial (${vsName})...`);

        const vectorStore = await openai.beta.vectorStores.create({
            name: vsName,
            expires_after: { anchor: 'last_active_at', days: 1 } // Auto-cleanup
        });
        vectorStoreId = vectorStore.id;

        // Attach File to VS
        await openai.beta.vectorStores.files.create(vectorStoreId, {
            file_id: fileId
        });

        // Poll for readiness
        onProgress?.('indexing', 'Procesando archivo para búsqueda...');
        let status = 'in_progress';
        while (status !== 'completed' && status !== 'failed') {
            if (signal?.aborted) throw new Error('Cancelled');
            await new Promise(resolve => setTimeout(resolve, 1000));
            const vs = await openai.beta.vectorStores.retrieve(vectorStoreId);
            status = vs.status;
            // Also check file status if needed, but VS status usually aggregates it
            if (status === 'in_progress') {
                const f = await openai.beta.vectorStores.files.retrieve(vectorStoreId, fileId);
                if (f.status === 'failed') status = 'failed';
            }
        }

        if (status === 'failed') throw new Error('OpenAI failed to process the PDF file.');
        if (signal?.aborted) throw new Error('Cancelled');

        // --- Step 2: Create Thread with Context ---
        onProgress?.('processing', 'Inicializando conversación...');

        // We attach the Dynamic VS to the Thread. 
        // The Assistant already has the Guide VS attached globally (from setup).
        const thread = await openai.beta.threads.create({
            tool_resources: {
                file_search: {
                    vector_store_ids: [vectorStoreId]
                }
            },
            messages: [
                {
                    role: "user",
                    content: "Analiza el documento legal adjunto (Pliego). Extrae los datos siguiendo estrictamente el esquema JSON definido."
                }
            ]
        });

        // --- Step 3: Run Assistant ---
        onProgress?.('analyzing', 'Ejecutando análisis estructurado (gpt-4o)...');

        const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
            assistant_id: assistantId,
            // Force strict mode output just in case, though Assistant config should handle it
            // response_format: zodResponseFormat(LicitacionResponseSchema, "pliego_analysis_schema") // Optional if defined in assistant
        });

        if (run.status === 'completed') {
            const messages = await openai.beta.threads.messages.list(thread.id);
            const lastMessage = messages.data[0];

            if (lastMessage.role === 'assistant' && lastMessage.content[0].type === 'text') {
                const rawJson = lastMessage.content[0].text.value;
                try {
                    return JSON.parse(rawJson);
                } catch (e) {
                    console.error("Failed to parse JSON output", rawJson);
                    throw new Error("La IA no devolvió un JSON válido");
                }
            } else {
                throw new Error("Formato de respuesta inesperado");
            }
        } else {
            console.error("Run failed:", run.last_error);
            throw new Error(`El análisis falló: ${run.last_error?.code || 'Error desconocido'}`);
        }

    } catch (error) {
        console.error('OpenAI Workflow Error:', error);
        throw error;
    } finally {
        // Cleanup Dynamic Resources
        // Note: We might want to keep them for chat, but for pure extraction we clean up.
        // User request "vector_store específico para esa licitación" suggests keeping it?
        // But "Asignar este Vector Store al THREAD" is done.
        // For now, let's clean up to avoid clutter unless persistence is requested.
        // Actually, user wants "Contexto específico para ese usuario". 
        // We'll leave it for now or rely on 'expires_after'. 
        // Current implementation had explicit cleanup. Let's keep explicit cleanup for now to be safe,
        // or rely on the expiry logic if we want to enable chat later.
        // Reverting to explicit update: User said "Asignar este Vector Store al THREAD... cuando crees la conversación".

        // Since we don't return the thread ID to the client yet, subsequent chats aren't possible anyway.
        // So cleaning up is safer to avoid leaks.
        if (vectorStoreId) {
            try {
                await openai.beta.vectorStores.del(vectorStoreId);
            } catch (e) { console.warn('Cleanup warning (VS):', e); }
        }
        if (fileId) {
            try {
                await openai.files.del(fileId);
            } catch (e) { console.warn('Cleanup warning (File):', e); }
        }
    }
}
