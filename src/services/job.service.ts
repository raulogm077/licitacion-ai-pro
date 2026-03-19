import { supabase } from '../config/supabase';
import { LicitacionContent } from '../types';
import { transformAgentResponseToFrontend } from '../agents/utils/schema-transformer';
import { LicitacionContentSchema } from '../lib/schemas';
import type { LicitacionAgentResponse } from '../agents/schemas/licitacion-agent.schema';
import type { ExtractionTemplate } from '../types';

export interface JobStatus {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    message?: string;
    step?: string;
    result?: LicitacionContent;
    error?: string;
}

export class JobService {
    /**
     * NEW: Analyze with Agents SDK (streaming)
     * This method calls the new analyze-with-agents Edge Function
     * and consumes the SSE stream for real-time progress
     */
    async analyzeWithAgents(
        pdfBase64: string,
        guiaBase64: string | null,
        filename: string,
        template: ExtractionTemplate | null = null,
        onProgress?: (event: StreamEvent) => void,
        files?: { name: string; base64: string }[]
    ): Promise<LicitacionContent> {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
            throw new Error('Usuario no autenticado');
        }

        try {
            // 1. Note: We'll use fetch API directly for streaming
            // supabase.functions.invoke doesn't support streaming properly

            console.log('[JobService] Usando fetch API para streaming...');

                        const projectUrl = import.meta.env.VITE_SUPABASE_URL;
            const functionUrl = `${projectUrl}/functions/v1/analyze-with-agents`;

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                },
                body: JSON.stringify({
                    pdfBase64,
                    guiaBase64,
                    filename,
                    template,
                    files
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (!response.body) {
                throw new Error('No response body');
            }

            // 3. Read SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finalResult: unknown = null;

            let reading = true;
            let streamError: Error | null = null;

            while (reading) {
                const { done, value } = await reader.read();

                if (done) {
                    reading = false;
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) {
                        continue;
                    }

                    let event: StreamEvent;
                    try {
                        event = JSON.parse(line.slice(6));
                    } catch (parseError) {
                        console.warn('[JobService] No se pudo parsear evento JSON:', line);
                        continue;
                    }

                    // Notify progress
                    if (onProgress) {
                        onProgress(event);
                    }

                    // Log important events
                    if (event.type === 'agent_message') {
                        console.debug(`[Agent]: ${typeof event.content === 'string'
                            ? event.content.substring(0, 80)
                            : JSON.stringify(event.content).substring(0, 80)}...`);
                        // Using debug level logic conceptually, keeping console.log for now as it's safe and expected
                    }

                    // Capture final result
                    if (event.type === 'complete' && event.result) {
                        finalResult = event.result;
                    }

                    // Handle application error (do not throw inside loop parsing try/catch)
                    if (event.type === 'error') {
                        streamError = new Error(event.message || 'Error en streaming');
                        reading = false;
                        break;
                    }
                }

                if (streamError) break;
            }

            if (streamError) {
                throw streamError;
            }

            if (!finalResult) {
                throw new Error('No se recibió resultado final del stream');
            }

            console.log('[JobService] Resultado recibido, aplicando transformación...');

            // 4. Transform from Agent schema to Frontend schema
            // Type assertion: we expect finalResult to match LicitacionAgentResponse
            const transformed = transformAgentResponseToFrontend(finalResult as LicitacionAgentResponse);

            // 5. Validate with frontend schema
            const validated = LicitacionContentSchema.parse(transformed);

            console.log('[JobService] ✅ Análisis completado y validado');
            const typedResult = finalResult as LicitacionAgentResponse;
            if (typedResult.workflow) {
                console.log(`[JobService] Quality: ${typedResult.workflow.quality?.overall || 'N/A'}`);
            }

            return validated;

        } catch (error: unknown) {
            console.error('[JobService] Error en análisis:', error);
            throw error;
        }
    }
}

// Type for streaming events
export interface StreamEvent {
    type: 'heartbeat' | 'agent_message' | 'complete' | 'error';
    content?: string | unknown;
    result?: unknown;
    message?: string;
    timestamp: number;
    eventsProcessed?: number;
}

export const jobService = new JobService();
