/* eslint-disable */
// @ts-ignore
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.39.3";

export class JobService {
    private supabase: SupabaseClient;

    constructor(supabaseAdminClient: SupabaseClient) {
        this.supabase = supabaseAdminClient;
    }

    async createJob(userId: string, filename: string, hash: string): Promise<string> {
        const { data: job, error } = await this.supabase
            .from('analysis_jobs')
            .insert({
                user_id: userId,
                status: 'pending',
                metadata: {
                    step: 'init',
                    message: 'Iniciando análisis...',
                    filename: filename || 'documento.pdf',
                    hash: hash
                }
            })
            .select('id')
            .single();

        if (error) throw new Error(`Failed to create job: ${error.message}`);
        return job.id;
    }

    async updateProgress(jobId: string, state: string, message: string, filename?: string, hash?: string): Promise<void> {
        console.log(`[Job ${jobId}] ${state}: ${message}`);

        // Build metadata update object safely
        const metadataUpdate: Record<string, any> = { step: state, message };
        if (filename) metadataUpdate.filename = filename;
        if (hash) metadataUpdate.hash = hash;

        await this.supabase.from('analysis_jobs').update({
            status: 'processing',
            metadata: metadataUpdate,
            updated_at: new Date().toISOString()
        }).eq('id', jobId);
    }

    async completeJob(jobId: string, result: Record<string, any>, filename: string, hash: string): Promise<void> {
        console.log(`[Job ${jobId}] Completed Successfully`);
        await this.supabase.from('analysis_jobs').update({
            status: 'completed',
            result: result,
            metadata: { step: 'done', message: 'Análisis completado', filename, hash },
            updated_at: new Date().toISOString()
        }).eq('id', jobId);
    }

    async failJob(jobId: string, errorMsg: string): Promise<void> {
        // Safe logging
        console.error(`[Job ${jobId}] Failed:`, errorMsg);
        await this.supabase.from('analysis_jobs').update({
            status: 'failed',
            error: errorMsg, // Ensure column exists in DB schema (it does)
            metadata: { step: 'error', message: 'Fallo el análisis' },
            updated_at: new Date().toISOString()
        }).eq('id', jobId);
    }
    async updateMetadata(jobId: string, metadata: Record<string, any>): Promise<void> {
        await this.supabase.from('analysis_jobs').update({
            metadata: metadata,
            updated_at: new Date().toISOString()
        }).eq('id', jobId);
    }
}
