/**
 * Fase A: Ingesta
 *
 * - Recibe archivos base64
 * - Sube a OpenAI Files API
 * - Crea vector store y espera indexación
 * - NO sube la guía al vector store (va en system prompt)
 */
import OpenAI from 'npm:openai@7.8.0';

export interface IngestionInput {
    openai: OpenAI;
    pdfBase64?: string;
    filename: string;
    files?: Array<{ name: string; base64: string }>;
    onProgress?: (msg: string) => void;
}

export interface IngestionResult {
    vectorStoreId: string;
    fileIds: string[];
    fileNames: string[];
}

function extractBase64Data(str: string): string {
    return str.includes(',') ? str.split(',')[1] : str;
}

function inferMimeType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (lower.endsWith('.txt')) return 'text/plain';
    return 'application/pdf';
}

export async function runIngestion(input: IngestionInput): Promise<IngestionResult> {
    const { openai, pdfBase64, filename, files, onProgress } = input;
    const uploadedFileIds: string[] = [];
    const fileNames: string[] = [];

    // 1. Upload main document
    if (pdfBase64) {
        onProgress?.('Subiendo documento principal...');
        const pdfBuffer = Uint8Array.from(atob(extractBase64Data(pdfBase64)), (c) => c.charCodeAt(0));
        const pdfUpload = await openai.files.create({
            file: new File([pdfBuffer], filename || 'documento.pdf', { type: 'application/pdf' }),
            purpose: 'assistants',
        });
        uploadedFileIds.push(pdfUpload.id);
        fileNames.push(filename || 'documento.pdf');
        console.log(`[Ingestion] PDF principal uploaded: ${pdfUpload.id}`);
    }

    // 2. Upload additional files sequentially (avoid memory spikes)
    if (files && Array.isArray(files)) {
        for (const extraFile of files) {
            if (extraFile?.base64 && extraFile?.name) {
                onProgress?.(`Subiendo ${extraFile.name}...`);
                const buffer = Uint8Array.from(atob(extractBase64Data(extraFile.base64)), (c) => c.charCodeAt(0));
                const mimeType = inferMimeType(extraFile.name);
                const upload = await openai.files.create({
                    file: new File([buffer], extraFile.name, { type: mimeType }),
                    purpose: 'assistants',
                });
                if (upload.id) {
                    uploadedFileIds.push(upload.id);
                    fileNames.push(extraFile.name);
                    console.log(`[Ingestion] Archivo adicional uploaded: ${upload.id}`);
                }
            }
        }
    }

    if (uploadedFileIds.length === 0) {
        throw new Error('No se subió ningún archivo');
    }

    // 3. Create Vector Store
    onProgress?.('Creando índice documental...');
    const vectorStore = await openai.vectorStores.create({
        name: `Análisis ${filename || 'documento'} - ${new Date().toISOString()}`,
        file_ids: uploadedFileIds,
    });
    const vectorStoreId = vectorStore.id;
    console.log(`[Ingestion] Vector Store created: ${vectorStoreId}`);

    // 4. Wait for indexing with exponential backoff
    onProgress?.('Indexando documentos...');
    let vectorStoreReady = false;
    let delay = 1000;
    const maxDelay = 5000;
    let totalTime = 0;
    const timeoutMs = 90000; // 90s for large documents

    while (totalTime < timeoutMs) {
        const vs = await openai.vectorStores.retrieve(vectorStoreId);
        if (vs.status === 'completed') {
            vectorStoreReady = true;
            console.log(`[Ingestion] Vector Store indexed in ~${totalTime}ms`);
            break;
        } else if (vs.status === 'failed') {
            throw new Error(`Vector Store indexing failed`);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        totalTime += delay;
        delay = Math.min(Math.round(delay * 1.5), maxDelay);
    }

    if (!vectorStoreReady) {
        console.warn(`[Ingestion] Vector Store indexing timeout (${timeoutMs}ms). Proceeding anyway.`);
    }

    return { vectorStoreId, fileIds: uploadedFileIds, fileNames };
}
