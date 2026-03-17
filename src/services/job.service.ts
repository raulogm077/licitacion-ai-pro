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
        onProgress?: (event: StreamEvent) => void
    ): Promise<LicitacionContent> {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
            throw new Error('Usuario no autenticado');
        }

        try {
            // 1. Note: We'll use fetch API directly for streaming
            // supabase.functions.invoke doesn't support streaming properly

            console.log('[JobService] Usando fetch API para streaming...');

            const { data: { session: currentSession } } = await supabase.auth.getSession();
            const projectUrl = import.meta.env.VITE_SUPABASE_URL;
            const functionUrl = `${projectUrl}/functions/v1/analyze-with-agents`;

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentSession?.access_token}`
                },
                body: JSON.stringify({
                    pdfBase64,
                    guiaBase64,
                    filename,
                    template
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

                    try {
                        const event = JSON.parse(line.slice(6));

                        // Notify progress
                        if (onProgress) {
                            onProgress(event);
                        }

                        // Log important events
                        if (event.type === 'agent_message') {
                            const preview = typeof event.content === 'string'
                                ? event.content.substring(0, 80)
                                : JSON.stringify(event.content).substring(0, 80);
                            console.log(`[Agent]: ${preview}...`);
                        }

                        // Capture final result
                        if (event.type === 'complete' && event.result) {
                            finalResult = event.result;
                            console.log('[JobService] Resultado final recibido del stream');
                        }

                        // Handle error
                        if (event.type === 'error') {
                            throw new Error(event.message || 'Error en streaming');
                        }

                    } catch (parseError) {
                        console.warn('[JobService] No se pudo parsear evento:', line);
                    }
                }
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
