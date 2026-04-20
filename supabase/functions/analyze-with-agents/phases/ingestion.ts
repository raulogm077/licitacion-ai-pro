/**
 * Fase A: Ingesta
 *
 * - Recibe archivos base64
 * - Sube a OpenAI Files API
 * - Crea vector store y espera indexación
 * - NO sube la guía al vector store (va en system prompt)
 */
import OpenAI from 'npm:openai@6.33.0';
import { VECTOR_STORE_TIMEOUT_MS } from '../../_shared/config.ts';
import { callWithTimeout } from '../../_shared/utils/timeout.ts';

export interface IngestionProgressUpdate {
    message: string;
    elapsedMs?: number;
    completedFiles?: number;
    inProgressFiles?: number;
    failedFiles?: number;
}

export interface IngestionInput {
    openai: OpenAI;
    pdfBase64?: string;
    filename: string;
    files?: Array<{ name: string; base64: string }>;
    onProgress?: (update: IngestionProgressUpdate) => void;
}

export interface IngestionDiagnostics {
    completedFiles: number;
    failedFiles: number;
    inProgressFiles: number;
    indexingElapsedMs: number;
    indexingTimedOut: boolean;
    zeroCompletedFiles: boolean;
}

export interface IngestionResult {
    vectorStoreId: string;
    fileIds: string[];
    fileNames: string[];
    diagnostics: IngestionDiagnostics;
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

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
}

async function runWithConcurrency<T>(items: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
    const results: T[] = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
        while (nextIndex < items.length) {
            const idx = nextIndex++;
            results[idx] = await items[idx]();
        }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

async function waitForVectorStoreIndexing(
    openai: OpenAI,
    vectorStoreId: string,
    onProgress?: (update: IngestionProgressUpdate) => void
): Promise<IngestionDiagnostics> {
    let delay = 1000;
    const maxDelay = 5000;
    let totalTime = 0;

    while (true) {
        const vs = await openai.vectorStores.retrieve(vectorStoreId);
        const fc = vs.file_counts;
        onProgress?.({
            message: `Indexando documentos... (${fc.completed} listos, ${fc.in_progress} en proceso, ${fc.failed} fallidos)`,
            elapsedMs: totalTime,
            completedFiles: fc.completed,
            inProgressFiles: fc.in_progress,
            failedFiles: fc.failed,
        });

        if (fc.in_progress === 0) {
            return {
                completedFiles: fc.completed,
                failedFiles: fc.failed,
                inProgressFiles: fc.in_progress,
                indexingElapsedMs: totalTime,
                indexingTimedOut: false,
                zeroCompletedFiles: fc.completed === 0,
            };
        }

        console.log(
            `[Ingestion] Indexing in progress — completed: ${fc.completed}, in_progress: ${fc.in_progress}, elapsed: ${totalTime}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        totalTime += delay;
        delay = Math.min(Math.round(delay * 1.5), maxDelay);
    }
}

export async function runIngestion(input: IngestionInput): Promise<IngestionResult> {
    const { openai, pdfBase64, filename, files, onProgress } = input;
    const uploadedFileIds: string[] = [];
    const fileNames: string[] = [];

    try {
        // 1. Upload main document
        if (pdfBase64) {
            onProgress?.({ message: 'Subiendo documento principal...' });
            let pdfBuffer: Uint8Array;
            try {
                pdfBuffer = Uint8Array.from(atob(extractBase64Data(pdfBase64)), (c) => c.charCodeAt(0));
            } catch {
                throw new Error('El archivo principal no tiene un formato base64 válido');
            }
            const pdfUpload = await openai.files.create({
                file: new File([toArrayBuffer(pdfBuffer)], filename || 'documento.pdf', {
                    type: 'application/pdf',
                }),
                purpose: 'assistants',
            });
            uploadedFileIds.push(pdfUpload.id);
            fileNames.push(filename || 'documento.pdf');
            console.log(`[Ingestion] PDF principal uploaded: ${pdfUpload.id}`);
        }

        // 2. Upload additional files with concurrency limit to avoid rate-limiting
        if (files && Array.isArray(files)) {
            const validFiles = files.filter((f) => f?.base64 && f?.name);
            if (validFiles.length > 0) {
                onProgress?.({ message: `Subiendo ${validFiles.length} archivos adicionales...` });
                const MAX_UPLOAD_CONCURRENCY = 3;
                const uploadTasks = validFiles.map((extraFile) => async () => {
                    let buffer: Uint8Array;
                    try {
                        buffer = Uint8Array.from(atob(extractBase64Data(extraFile.base64)), (c) => c.charCodeAt(0));
                    } catch {
                        console.warn(`[Ingestion] Skipping ${extraFile.name}: invalid base64`);
                        return null;
                    }
                    const mimeType = inferMimeType(extraFile.name);
                    const upload = await openai.files.create({
                        file: new File([toArrayBuffer(buffer)], extraFile.name, { type: mimeType }),
                        purpose: 'assistants',
                    });
                    return { id: upload.id, name: extraFile.name };
                });

                const results = await runWithConcurrency(uploadTasks, MAX_UPLOAD_CONCURRENCY);
                for (const result of results) {
                    if (result) {
                        uploadedFileIds.push(result.id);
                        fileNames.push(result.name);
                        console.log(`[Ingestion] Archivo adicional uploaded: ${result.id}`);
                    }
                }
            }
        }
    } catch (error) {
        // Cleanup any uploaded files on failure
        for (const fileId of uploadedFileIds) {
            openai.files.delete(fileId).catch((e) => console.warn(`[Ingestion] Cleanup failed for ${fileId}:`, e));
        }
        throw error;
    }

    if (uploadedFileIds.length === 0) {
        throw new Error('No se subió ningún archivo');
    }

    // 3. Create Vector Store
    onProgress?.({ message: 'Creando índice documental...' });
    const vectorStore = await openai.vectorStores.create({
        name: `Análisis ${filename || 'documento'} - ${new Date().toISOString()}`,
        file_ids: uploadedFileIds,
    });
    const vectorStoreId = vectorStore.id;
    console.log(`[Ingestion] Vector Store created: ${vectorStoreId}`);

    // 4. Wait for indexing — poll file_counts.in_progress, not vs.status.
    // vs.status becomes 'completed' immediately after VS creation even while
    // files are still being processed. file_counts reflects actual indexing state.
    let diagnostics: IngestionDiagnostics;
    try {
        diagnostics = await callWithTimeout(
            waitForVectorStoreIndexing(openai, vectorStoreId, onProgress),
            VECTOR_STORE_TIMEOUT_MS,
            'Vector Store Indexing'
        );
        const outcome =
            diagnostics.failedFiles > 0
                ? `${diagnostics.failedFiles} failed, ${diagnostics.completedFiles} ok`
                : `${diagnostics.completedFiles} ok`;
        console.log(`[Ingestion] Vector Store indexed in ~${diagnostics.indexingElapsedMs}ms (${outcome})`);
    } catch (error) {
        const vs = await openai.vectorStores.retrieve(vectorStoreId);
        const fc = vs.file_counts;
        diagnostics = {
            completedFiles: fc.completed,
            failedFiles: fc.failed,
            inProgressFiles: fc.in_progress,
            indexingElapsedMs: VECTOR_STORE_TIMEOUT_MS,
            indexingTimedOut: true,
            zeroCompletedFiles: fc.completed === 0,
        };
        console.warn(
            `[Ingestion] Vector Store indexing timeout after ${VECTOR_STORE_TIMEOUT_MS}ms — proceeding with partial index. ` +
                `file_counts: completed=${fc.completed}, in_progress=${fc.in_progress}, failed=${fc.failed}`
        );
        console.warn('[Ingestion] Timeout details:', error);
        onProgress?.({
            message: `Indexación parcial: ${fc.completed} listos, ${fc.in_progress} pendientes, ${fc.failed} fallidos.`,
            elapsedMs: VECTOR_STORE_TIMEOUT_MS,
            completedFiles: fc.completed,
            inProgressFiles: fc.in_progress,
            failedFiles: fc.failed,
        });
    }

    if (diagnostics.failedFiles > 0) {
        console.warn(
            `[Ingestion] ⚠️  ${diagnostics.failedFiles} file(s) FAILED to index. The PDF may be scanned (image-only) or corrupted.`
        );
    }
    if (diagnostics.zeroCompletedFiles) {
        console.warn(`[Ingestion] ⚠️  No files completed indexing. Content extraction will likely return empty results.`);
    }

    return { vectorStoreId, fileIds: uploadedFileIds, fileNames, diagnostics };
}
