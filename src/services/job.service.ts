
import { supabase } from '../config/supabase';
import { LicitacionContent } from '../types';

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
     * Starts a new analysis job on the server (OpenAI Async)
     */
    async startJob(fileBase64: string, fileName: string, fileHash: string): Promise<string> {
        // Explicitly get session to ensure we send the token
        const { data: { session } } = await supabase.auth.getSession();

        const { data, error } = await supabase.functions.invoke('openai-runner', {
            body: {
                pdfBase64: fileBase64,
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
     * Polls until completion or timeout (Active Sync)
     */
    async waitForCompletion(jobId: string, onUpdate?: (status: JobStatus) => void): Promise<LicitacionContent> {
        return new Promise((resolve, reject) => {
            const MAX_TOTAL_WAIT_MS = 60 * 60 * 1000; // 60 mins (Generous Timeout)
            const SYNC_INTERVAL_MS = 60000; // 60s Sync Interval

            const startTime = Date.now();
            // Start polling loop
            let lastMessage = "";

            console.log(`[JobService] Starting Active Sync Loop for Job ${jobId}. Interval: 60s`);

            const interval = setInterval(async () => {
                const elapsed = Date.now() - startTime;

                // 1. Strict Timeout Check
                if (elapsed > MAX_TOTAL_WAIT_MS) {
                    clearInterval(interval);
                    reject(new Error("TIMEOUT_CLIENT_SIDE: El análisis ha tardado demasiado (30m)."));
                    return;
                }

                // 2. Poll DB for status (Read-Only Check)
                const { data: job, error } = await supabase
                    .from('analysis_jobs')
                    .select('*')
                    .eq('id', jobId)
                    .single();

                if (error || !job) {
                    console.warn("Error polling job:", error);
                    return;
                }

                // Update UI
                if (onUpdate) onUpdate(job);

                // Activity Check
                const currentMessage = job.metadata?.message || "";
                if (currentMessage !== lastMessage) {
                    console.log(`[JobService] Activity: ${currentMessage}`);
                    lastMessage = currentMessage;

                }

                // 3. Handle Completion
                if (job.status === 'completed' && job.result) {
                    clearInterval(interval);
                    console.log("Job Completed!", job.result);
                    resolve(job.result as LicitacionContent);
                    return;
                }

                if (job.status === 'failed') {
                    clearInterval(interval);
                    reject(new Error(job.error || "Job failed"));
                    return;
                }

                // 4. TRIGGER BACKEND SYNC (The Driver)
                // We only sync if status is processing to "wake up" the backend logic
                if (job.status === 'processing') {
                    console.log(`[JobService] 🔄 Triggering Backend Sync...`);
                    try {
                        const { error: invokeError } = await supabase.functions.invoke('openai-runner', {
                            body: { action: 'sync', jobId: jobId, pdfBase64: null, hash: null }
                        });
                        if (invokeError) console.warn("[JobService] Sync invoke warn:", invokeError);
                    } catch (invokeTrap) {
                        console.warn("[JobService] Sync invoke failed (transient):", invokeTrap);
                    }
                }

            }, SYNC_INTERVAL_MS);
        });
    }
}

export const jobService = new JobService();
