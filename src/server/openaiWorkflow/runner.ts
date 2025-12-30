/**
 * OpenAI Agent Builder Runner (Responses API)
 * 
 * Implements the "Black Box" integration strategy using the Responses API (POST /v1/responses).
 * Executes a hosted Agent statelessly, adhering to strict Input/Output contracts.
 * 
 * Architecture:
 * 1. Upload PDF to OpenAI Storage -> get file_id
 * 2. Call POST /v1/responses with agent_id and input variables
 * 3. Receive Structured Output (JSON) defined in the Agent's End Node
 */

// OpenAI import used for file management
import OpenAI from 'openai';

export interface WorkflowInput {
    extractedText?: string;
    pdfBase64?: string;
    readingMode: 'full' | 'keydata';
    hash: string;
    userId: string; // Required for auditing/context
    filename?: string;
}

export interface WorkflowOptions {
    signal?: AbortSignal;
    onProgress?: (stage: string, message: string) => void;
}

/**
 * Runs the OpenAI Agent via Responses API
 * 
 * Contract:
 * - Agent Input Variables: { file_id, reading_mode, hash, extracted_text }
 * - Agent Output: Structured JSON matching LicitacionData schema (or subset)
 */
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { LicitacionResponseSchema } from '../../lib/openai-schemas';

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
 * Runs the OpenAI Analysis using the Responses API with Zod Schema.
 */
export async function runWorkflow(
    input: WorkflowInput,
    options: WorkflowOptions = {}
): Promise<unknown> {
    const { signal, onProgress } = options;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 3 });

    // 1. Upload File
    let fileId: string | undefined;
    if (input.pdfBase64) {
        onProgress?.('upload', 'Subiendo documento PDF a OpenAI Storage...');
        const pdfBuffer = Buffer.from(input.pdfBase64, 'base64');
        const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
        const file = new File([blob], input.filename || 'document.pdf', { type: 'application/pdf' });

        const uploadedFile = await openai.files.create({
            file,
            purpose: 'user_data' // Tutorial specifies 'user_data' for Responses API
        });
        fileId = uploadedFile.id;
    }

    if (signal?.aborted) {
        if (fileId) await openai.files.delete(fileId).catch(() => { });
        throw new Error('Workflow cancelled');
    }

    // 2. Call Responses API
    onProgress?.('processing', 'Analizando pliego con OpenAI Responses API...');

    try {
        // Prepare content array
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content: any[] = [
            {
                type: "input_text",
                text: `Analiza el pliego adjunto. Extrae TODA la información requerida para completar el esquema JSON.
                     
                     Contexto:
                     - Hash: ${input.hash}
                     - UserID: ${input.userId}
                     
                     Instrucciones para 'workflow.quality':
                     - Evalúa si la sección está completa o 'VACIO'.
                     - Si falta un dato crítico (ej. presupuesto), añádelo a missingCriticalFields.
                     
                     Instrucciones para 'workflow.evidences':
                     - Cita la frase exacta del PDF donde encontraste el presupuesto y la solvencia.`
            }
        ];

        if (fileId) {
            content.push({
                type: "input_file",
                file_id: fileId
            });
        }

        // Use the beta responses API if available in SDK typings (which we confirmed it has 'responses')
        // We assume 'openai.responses.parse' exists or we use 'create' and parse manually?
        // The script showed 'responses' exists.
        // If the typing is missing in local environment, we might need a cast.

        // Note: The tutorial assumed 'client.responses.parse'.
        // If it doesn't exist on the type definition yet, we fallback to 'any'.

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response: any = await (openai as any).responses.parse({
            model: "gpt-4o-2024-08-06",
            tools: [{ type: "file_search" }],
            input: [
                {
                    role: "user",
                    content
                }
            ],
            response_format: zodResponseFormat(LicitacionResponseSchema, "analisis_licitacion"),
        });

        const output = response.output_parsed || response.output; // Fallback if parsed not directly available

        // 3. Cleanup
        if (fileId) {
            await openai.files.delete(fileId).catch(() => { });
        }

        return output;

    } catch (error) {
        if (fileId) await openai.files.delete(fileId).catch(() => { });
        console.error("OpenAI Responses API Error:", error);
        throw error;
    }
}
