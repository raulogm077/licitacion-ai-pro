
/**
 * OpenAI Agent Runner (Agents SDK)
 * 
 * Implements the "Assisted RAG" flow using the @openai/agents SDK:
 * 1. Ingest Document -> Vector Store (Standard API)
 * 2. Create Agent with File Search Tool (Agents SDK)
 * 3. Run Agent to extract structured data (Agents SDK)
 */

import OpenAI from 'openai';
import { Agent, run } from '@openai/agents';
import { fileSearchTool } from '@openai/agents';
import { LicitacionResponseSchema } from '../../lib/openai-schemas';

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
 * Main Entry Point: Orchestrates the Analysis Workflow via Agents SDK
 */
export async function runWorkflow(
    input: WorkflowInput,
    options: WorkflowOptions = {}
): Promise<unknown> {
    const { onProgress, signal } = options;
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
    
    // Critical: Agents SDK uses process.env.OPENAI_API_KEY by default
    process.env.OPENAI_API_KEY = apiKey;

    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 3 });

    let vectorStoreId: string | undefined;
    let fileId: string | undefined;

    try {
        // --- Module 1: Document Ingestion (Standard API) ---
        // We still use standard API for file management as Agents SDK wrappers expect existing resources.

        if (!input.pdfBase64) {
            throw new Error('PDF Content required for Agent analysis');
        }

        onProgress?.('upload', 'Subiendo documento a OpenAI Cloud...');
        const pdfBuffer = Buffer.from(input.pdfBase64, 'base64');
        const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
        // Need to cast to any to satisfy OpenAI type requirement for 'File' interface overlap
        const file = new File([blob], input.filename || 'pliego.pdf', { type: 'application/pdf' });

        const uploadedFile = await openai.files.create({
            file: file,
            purpose: 'assistants'
        });
        fileId = uploadedFile.id;

        if (signal?.aborted) throw new Error('Cancelled');

        // Create Vector Store
        onProgress?.('indexing', 'Creando índice vectorial (Vector Store)...');
        const vectorStore = await openai.vectorStores.create({
            name: `Licitacion-${input.hash.substring(0, 8)}`,
            expires_after: { anchor: 'last_active_at', days: 1 }
        });
        vectorStoreId = vectorStore.id;

        // Link File
        await openai.vectorStores.files.create(vectorStoreId, {
            file_id: fileId
        });

        // POLLING: Wait for file processing to complete
        // This is critical for Agents SDK to "see" the content immediately
        onProgress?.('indexing', 'Procesando archivo para búsqueda...');
        let status = 'in_progress';
        while (status !== 'completed' && status !== 'failed') {
            if (signal?.aborted) throw new Error('Cancelled');
            await new Promise(resolve => setTimeout(resolve, 1000));
            const f = await openai.vectorStores.files.retrieve(fileId, { vector_store_id: vectorStoreId });
            status = f.status;
        }

        if (status === 'failed') throw new Error('OpenAI failed to process the PDF file.');
        
        if (signal?.aborted) throw new Error('Cancelled');

        // --- Module 2: Agent Definition (Agents SDK) ---
        onProgress?.('processing', 'Inicializando Agente de Análisis...');

        const agent = new Agent({
            name: "Analista de Pliegos",
            model: "gpt-4o",
            instructions: `Eres un experto legal en licitaciones públicas ("Analista de Pliegos").
            Tu tarea es leer documentos técnicos y administrativos (Pliegos) y extraer datos estructurados.
            
            REGLAS:
            1. Cita siempre la fuente. Usa annotations para referenciar la página del PDF.
            2. Si un dato no existe, déjalo como null, 0 o array vacío según el tipo. No inventes.
            3. Para campos de texto libre, sé conciso pero captura el detalle técnico importante.
            4. Basa tu respuesta EXCLUSIVAMENTE en el archivo adjunto.
            `,
            tools: [fileSearchTool([vectorStoreId])],
            outputType: LicitacionResponseSchema
        });

        // --- Module 3: Execution ---
        onProgress?.('analyzing', 'Ejecutando análisis estructurado...');
        
        const result = await run(agent, "Analiza el documento legal adjunto (Pliego) y extrae TODOS los datos solicitados en la estructura JSON. Busca específicamente el Presupuesto, Solvencia y Criterios. Si el documento es corto o parece una prueba, extrae lo que haya.");

        // The result.finalOutput is already typed/parsed by outputType (Zod)
        return result.finalOutput;

    } catch (error) {
        console.error('OpenAI Agent Workflow Error:', error);
        throw error;
    } finally {
        // Cleanup
        if (vectorStoreId) {
            try {
                await openai.vectorStores.delete(vectorStoreId);
            } catch (e) { console.warn('Cleanup warning (VectorStore):', e); }
        }
        if (fileId) {
            try {
                await openai.files.delete(fileId);
            } catch (e) { console.warn('Cleanup warning (File):', e); }
        }
    }
}
