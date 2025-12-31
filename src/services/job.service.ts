
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
        const { data, error } = await supabase.functions.invoke('openai-runner', {
            body: {
                pdfBase64: fileBase64,
                filename: fileName,
                hash: fileHash,
                readingMode: 'full'
            }
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
     * Polls until completion or timeout (Helper for simple flows)
     */
    async waitForCompletion(
        jobId: string,
        onProgress?: (status: JobStatus) => void,
        signal?: AbortSignal
    ): Promise<LicitacionContent> {
        let attempts = 0;
        const maxAttempts = 120; // 4 minutes

        while (attempts < maxAttempts) {
            if (signal?.aborted) throw new Error('Operación cancelada');

            const status = await this.pollJob(jobId);

            if (onProgress) onProgress(status);

            if (status.status === 'completed' && status.result) {
                return status.result;
            }

            if (status.status === 'failed') {
                throw new Error(status.error || 'El análisis falló en el servidor');
            }

            await new Promise(r => setTimeout(r, 2000));
            attempts++;
        }

        throw new Error('Tiempo de espera agotado (Timeout)');
    }
}

export const jobService = new JobService();
