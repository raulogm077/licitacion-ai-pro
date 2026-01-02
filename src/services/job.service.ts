
import { supabase } from '../config/supabase';
import { LicitacionContent } from '../types';
import { transformAgentResponseToFrontend } from '../agents/utils/schema-transformer';
import { LicitacionContentSchema } from '../lib/schemas';

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
     * Starts a new analysis job
     * Now uploads PDF to Storage first, then enqueues with URL (not base64)
     * This reduces queue message size from ~7MB to ~1KB
     */
    async startJob(fileBase64: string, fileName: string, fileHash: string): Promise<string> {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
            throw new Error('Usuario no autenticado');
        }

        try {
            // 1. Upload PDF to Supabase Storage
            const storagePath = `${session.user.id}/${fileHash}.pdf`;

            // Convert base64 to Blob
            const pdfBlob = this.base64ToBlob(fileBase64, 'application/pdf');

            const { error: uploadError } = await supabase.storage
                .from('analysis-pdfs')
                .upload(storagePath, pdfBlob, {
                    cacheControl: '3600',
                    upsert: true // Overwrite if exists (same hash)
                });

            if (uploadError) {
                throw new Error(`Error subiendo PDF a Storage: ${uploadError.message}`);
            }

            console.log(`[JobService] PDF uploaded to Storage: ${storagePath}`);

            // 2. Enqueue job with Storage URL (not base64)
            const { data, error } = await supabase.functions.invoke('openai-runner', {
                body: {
                    action: 'start',
                    // pdfBase64,  // ❌ OLD: ~7MB in queue message
                    storageUrl: storagePath,  // ✅ NEW: ~50 bytes
                    filename: fileName,
                    hash: fileHash,
                    readingMode: 'full'
                },
                headers: session?.access_token ? {
                    Authorization: `Bearer ${session.access_token}`
                } : undefined
            });

            if (error || !data?.jobId) {
                throw new Error(`Error iniciando trabajo: ${error?.message || 'Respuesta inválida del servidor'}`);
            }

            return data.jobId;
        } catch (error: any) {
            console.error('[JobService] Error in startJob:', error);
            throw error;
        }
    }

    /**
     * Helper: Convert base64 string to Blob
     */
    private base64ToBlob(base64: string, mimeType: string): Blob {
        // Remove data URL prefix if present
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    /**
     * Polls the job status once
     */
    async pollJob(jobId: string): Promise<JobStatus> {
        const { data, error } = await supabase
            .from('analysis_jobs')
            .select('id, status, error, metadata, result')
            .eq('id', jobId)
            .single();

        if (error) {
            throw new Error(`Error consultando estado del trabajo: ${error.message}`);
        }

        return {
            id: data.id,
            status: data.status,
            error: data.error,
            message: data.metadata?.message,
            step: data.metadata?.step,
            result: data.result as LicitacionContent
        };
    }

    /**
     * Polls until completion or timeout
     */
    async waitForCompletion(jobId: string, onUpdate?: (status: JobStatus) => void): Promise<LicitacionContent> {
        return new Promise((resolve, reject) => {
            const MAX_TOTAL_WAIT_MS = 60 * 60 * 1000; // 60 mins
            const SYNC_INTERVAL_MS = 60000; // 60s

            const startTime = Date.now();
            let lastMessage = '';

            console.log(`[JobService] Starting polling for Job ${jobId}. Interval: 60s`);

            const interval = setInterval(async () => {
                const elapsed = Date.now() - startTime;

                // 1. Check timeout
                if (elapsed > MAX_TOTAL_WAIT_MS) {
                    clearInterval(interval);
                    const minutes = Math.floor(elapsed / 60000);
                    reject(new Error(`Timeout: El análisis superó ${minutes} minutos.`));
                    return;
                }

                // 2. Poll job status
                const { data: job, error } = await supabase
                    .from('analysis_jobs')
                    .select('*')
                    .eq('id', jobId)
                    .single();

                if (error || !job) {
                    console.error('[JobService] Poll error:', error);
                    return; // Continue trying
                }

                // 3. Track activity
                const currentMessage = job.metadata?.message || '';
                if (currentMessage !== lastMessage) {
                    console.log(`[JobService] Activity: ${currentMessage}`);
                    lastMessage = currentMessage;
                }

                // 4. Notify callback
                if (onUpdate) {
                    onUpdate({
                        id: job.id,
                        status: job.status,
                        error: job.error,
                        message: currentMessage,
                        step: job.metadata?.step,
                        result: job.result
                    });
                }

                // 5. Handle completion
                if (job.status === 'completed') {
                    clearInterval(interval);
                    if (!job.result) {
                        reject(new Error('Job completado pero sin resultado.'));
                        return;
                    }
                    resolve(job.result as LicitacionContent);
                    return;
                }

                if (job.status === 'failed') {
                    clearInterval(interval);
                    reject(new Error(job.error || 'Job failed'));
                    return;
                }


            }, SYNC_INTERVAL_MS);
        })
    }

    /**
     * NEW: Analyze with Agents SDK (streaming)
     * This method calls the new analyze-with-agents Edge Function
     * and consumes the SSE stream for real-time progress
     */
    async analyzeWithAgents(
        pdfBase64: string,
        guiaBase64: string | null,
        filename: string,
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
                    filename
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
            let finalResult: any = null;

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
            const transformed = transformAgentResponseToFrontend(finalResult);

            // 5. Validate with frontend schema
            const validated = LicitacionContentSchema.parse(transformed);

            console.log('[JobService] ✅ Análisis completado y validado');
            if (finalResult.workflow) {
                console.log(`[JobService] Quality: ${finalResult.workflow.quality?.overall || 'N/A'}`);
            }

            return validated;

        } catch (error: any) {
            console.error('[JobService] Error en análisis:', error);
            throw error;
        }
    }
}

// Type for streaming events
export interface StreamEvent {
    type: 'heartbeat' | 'agent_message' | 'complete' | 'error';
    content?: string | any;
    result?: any;
    message?: string;
    timestamp: number;
    eventsProcessed?: number;
}

export const jobService = new JobService();
