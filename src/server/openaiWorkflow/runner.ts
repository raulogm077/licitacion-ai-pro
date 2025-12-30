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
export async function runWorkflow(
    input: WorkflowInput,
    options: WorkflowOptions = {}
): Promise<unknown> {
    const { signal, onProgress } = options;

    const apiKey = process.env.OPENAI_API_KEY;
    // We use OPENAI_AGENT_ID to match the "Agent Builder" terminology, 
    // though internally it might be a workflow_id.
    const agentId = process.env.OPENAI_AGENT_ID || process.env.OPENAI_ASSISTANT_ID;

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY not configured');
    }

    if (!agentId) {
        throw new Error('OPENAI_AGENT_ID (or OPENAI_ASSISTANT_ID) not configured.');
    }

    if (signal?.aborted) throw new Error('Workflow cancelled');

    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true }); // We use 'fetch' for the agent, but SDK for files.

    // 1. Upload File (if provided)
    let fileId: string | undefined;
    if (input.pdfBase64) {
        onProgress?.('upload', 'Subiendo documento PDF a OpenAI Storage...');
        const pdfBuffer = Buffer.from(input.pdfBase64, 'base64');
        const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
        const file = new File([blob], input.filename || 'document.pdf', { type: 'application/pdf' });

        const uploadedFile = await openai.files.create({
            file,
            purpose: 'assistants' // Agents typically access 'assistants' purpose files
        });
        fileId = uploadedFile.id;
    }

    if (signal?.aborted) {
        if (fileId) await openai.files.delete(fileId).catch(() => { });
        throw new Error('Workflow cancelled');
    }

    // 2. Prepare Input Payload (Method 1: File Reference)
    // We construct a User Message that includes the File Attachment.

    const contextSettings = {
        user_id: input.userId,
        reading_mode: input.readingMode,
        hash: input.hash
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userMessageContent: any[] = [
        {
            type: "text",
            text: `CONTEXTO DEL SISTEMA (Variables de Estado):\n${JSON.stringify(contextSettings, null, 2)}\n\nINSTRUCCIÓN:\nAnaliza el documento adjunto (PLIEGO) y extrae los datos siguiendo estrictamente el esquema de salida JSON definido.`
        }
    ];

    if (fileId) {
        userMessageContent.push({
            type: "input_file",
            file_id: fileId
        });
    } else if (input.extractedText) {
        // Fallback or auxiliary text if no PDF (less robust for complex docs)
        userMessageContent.push({
            type: "text",
            text: `CONTENIDO DEL DOCUMENTO:\n${input.extractedText.substring(0, 100000)}`
        });
    }

    const payload = {
        agent_id: agentId,
        input: [
            {
                role: "user",
                content: userMessageContent
            }
        ],
        stream: true
    };

    // 3. Call Responses API
    // Using raw fetch because SDK might not support /v1/responses yet
    onProgress?.('processing', 'Invocando Agente de IA (Method 1: File Ref)...');

    try {
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error ejecución Agente (${response.status}): ${errorText}`);
        }

        if (!response.body) throw new Error('No response body from Agent');

        // 4. Handle Streaming Response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '').trim();
                    if (dataStr === '[DONE]') continue;

                    try {
                        const event = JSON.parse(dataStr);

                        // Capture "deltas" for thinking/processing feedback
                        if (event.delta?.content) {
                            const text = event.delta.content;
                            // Filter out JSON markers if they appear early to avoid cluttering "thinking" log
                            if (!text.includes('```json')) {
                                onProgress?.('delta', text);
                            }
                            fullContent += text;
                        }
                    } catch (e) {
                        // ignore parse error on partial chunks
                    }
                }
            }
        }

        // 5. Cleanup
        if (fileId) {
            try {
                // We delete the file after use to avoid cluttering storage, 
                // UNLESS we want to keep it for history. User req mentions history in DB, not OpenAI.
                await openai.files.delete(fileId);
            } catch (e) {
                console.warn('Failed to delete temp file:', e);
            }
        }

        // 6. Parse Output (Contract of Exit)
        // Extract JSON from potential Markdown wrapper
        try {
            let jsonString = fullContent;
            const jsonMatch = fullContent.match(/```json\s*(\{[\s\S]*?\})\s*```/);
            if (jsonMatch) {
                jsonString = jsonMatch[1];
            } else {
                // Try finding first { and last }
                const firstBrace = fullContent.indexOf('{');
                const lastBrace = fullContent.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    jsonString = fullContent.substring(firstBrace, lastBrace + 1);
                }
            }

            return JSON.parse(jsonString);
        } catch (e) {
            console.error('Failed to parse Agent output as JSON:', fullContent);
            // Fallback: If strict parsing fails, return raw content but throw usage error?
            // User requirement: "Control de errores para garantizar que todo sale bien"
            throw new Error('El Agente no devolvió una respuesta JSON válida. Respuesta recibida: ' + fullContent.substring(0, 100));
        }

    } catch (error) {
        if (fileId) await openai.files.delete(fileId).catch(() => { });
        throw error;
    }
}
