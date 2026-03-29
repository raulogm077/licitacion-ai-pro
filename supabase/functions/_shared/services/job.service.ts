/**
 * Job Service — manages analysis_jobs table for pipeline tracking.
 */
// @ts-expect-error — npm: specifier resolved at Deno runtime
import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.3';

export class JobService {
    private supabase: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        this.supabase = supabaseClient;
    }

    async createJob(
        userId: string,
        filename: string,
        vectorStoreId?: string,
        fileIds?: string[],
        cleanupAt?: string
    ): Promise<string> {
        const { data: job, error } = await this.supabase
            .from('analysis_jobs')
            .insert({
                user_id: userId,
                status: 'processing',
                phase: 'ingestion',
                vector_store_id: vectorStoreId,
                file_ids: fileIds || [],
                metadata: { filename },
                cleanup_at: cleanupAt,
            })
            .select('id')
            .single();

        if (error) throw new Error(`Failed to create job: ${error.message}`);
        return job.id;
    }

    async updatePhase(jobId: string, phase: string, phaseResult?: unknown): Promise<void> {
        console.log(`[Job ${jobId}] Phase: ${phase}`);

        const update: Record<string, unknown> = {
            phase,
            status: 'processing',
            updated_at: new Date().toISOString(),
        };

        if (phaseResult) {
            // Merge phase result into phase_results JSON
            const { data: current } = await this.supabase
                .from('analysis_jobs')
                .select('phase_results')
                .eq('id', jobId)
                .single();

            update.phase_results = {
                ...(current?.phase_results || {}),
                [phase]: phaseResult,
            };
        }

        await this.supabase.from('analysis_jobs').update(update).eq('id', jobId);
    }

    async setDocumentMap(jobId: string, documentMap: unknown): Promise<void> {
        await this.supabase
            .from('analysis_jobs')
            .update({
                document_map: documentMap,
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
    }

    async completeJob(jobId: string, result: unknown): Promise<void> {
        console.log(`[Job ${jobId}] Completed`);
        await this.supabase
            .from('analysis_jobs')
            .update({
                status: 'completed',
                phase: 'completed',
                result,
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
    }

    async failJob(jobId: string, errorMsg: string): Promise<void> {
        console.error(`[Job ${jobId}] Failed:`, errorMsg);
        await this.supabase
            .from('analysis_jobs')
            .update({
                status: 'failed',
                phase: 'failed',
                error: errorMsg,
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
    }

    async markForCleanup(jobId: string, cleanupAt: string): Promise<void> {
        await this.supabase.from('analysis_jobs').update({ cleanup_at: cleanupAt }).eq('id', jobId);
    }

    async getExpiredJobs(): Promise<Array<{ id: string; vector_store_id?: string; file_ids?: string[] }>> {
        const { data, error } = await this.supabase
            .from('analysis_jobs')
            .select('id, vector_store_id, file_ids')
            .lt('cleanup_at', new Date().toISOString())
            .in('status', ['completed', 'failed'])
            .not('vector_store_id', 'is', null)
            .limit(10);

        if (error) {
            console.error('[JobService] Failed to get expired jobs:', error);
            return [];
        }
        return data || [];
    }
}
