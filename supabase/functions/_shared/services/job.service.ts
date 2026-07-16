/**
 * Job Service — manages analysis_jobs table for pipeline tracking.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.3';

export type AnalysisStepName = 'ingestion_map' | 'extraction' | 'consolidation' | 'validation';

export interface DurableJobCreation {
    jobId: string;
    created: boolean;
}

export class JobService {
    private supabase: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        this.supabase = supabaseClient;
    }

    async createDurableJob(
        userId: string,
        filename: string,
        idempotencyKey: string,
        inputFingerprint: string,
        runtimeVersion: Record<string, unknown>,
        retentionUntil: string
    ): Promise<DurableJobCreation> {
        const { data, error } = await this.supabase.rpc('create_analysis_job', {
            p_user_id: userId,
            p_filename: filename,
            p_idempotency_key: idempotencyKey,
            p_input_fingerprint: inputFingerprint,
            p_runtime_version: runtimeVersion,
            p_retention_until: retentionUntil,
            p_metadata: { requestSource: 'analyze-with-agents' },
        });

        if (error) throw new Error(`Failed to create durable job: ${error.message}`);
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.job_id) throw new Error('Failed to create durable job: missing job id');
        return { jobId: row.job_id, created: row.created === true };
    }

    async getJob(jobId: string): Promise<Record<string, unknown> | null> {
        const { data, error } = await this.supabase
            .from('analysis_jobs')
            .select('id, status, phase, result, error')
            .eq('id', jobId)
            .maybeSingle();
        if (error) throw new Error(`Failed to read job: ${error.message}`);
        return data;
    }

    async startStep(
        jobId: string,
        stepName: AnalysisStepName,
        workerId: string,
        payload: Record<string, unknown> = {},
        leaseSeconds = 900
    ): Promise<void> {
        const { error: enqueueError } = await this.supabase.rpc('enqueue_analysis_step', {
            p_job_id: jobId,
            p_step_name: stepName,
            p_payload: payload,
        });
        if (enqueueError) throw new Error(`Failed to enqueue ${stepName}: ${enqueueError.message}`);

        const { data: claimed, error: claimError } = await this.supabase.rpc('claim_analysis_step', {
            p_job_id: jobId,
            p_step_name: stepName,
            p_worker_id: workerId,
            p_lease_seconds: leaseSeconds,
        });
        if (claimError) throw new Error(`Failed to claim ${stepName}: ${claimError.message}`);
        if (claimed !== true) throw new Error(`Step ${stepName} is already owned by another worker`);
    }

    async completeStep(
        jobId: string,
        stepName: AnalysisStepName,
        workerId: string,
        outputRef: Record<string, unknown> = {}
    ): Promise<void> {
        const { data: completed, error } = await this.supabase.rpc('complete_analysis_step', {
            p_job_id: jobId,
            p_step_name: stepName,
            p_worker_id: workerId,
            p_output_ref: outputRef,
        });
        if (error) throw new Error(`Failed to complete ${stepName}: ${error.message}`);
        if (completed !== true) throw new Error(`Lost lease while completing ${stepName}`);
    }

    async failStep(
        jobId: string,
        stepName: AnalysisStepName,
        workerId: string,
        errorMessage: string,
        retryDelaySeconds = 60
    ): Promise<string> {
        const { data, error } = await this.supabase.rpc('fail_analysis_step', {
            p_job_id: jobId,
            p_step_name: stepName,
            p_worker_id: workerId,
            p_error: errorMessage,
            p_retry_delay_seconds: retryDelaySeconds,
        });
        if (error) throw new Error(`Failed to persist ${stepName} failure: ${error.message}`);
        return String(data || 'failed');
    }

    async setExternalResources(
        jobId: string,
        vectorStoreId: string,
        fileIds: string[],
        documentIds: string[]
    ): Promise<void> {
        const { error: jobError } = await this.supabase
            .from('analysis_jobs')
            .update({ vector_store_id: vectorStoreId, file_ids: fileIds })
            .eq('id', jobId);
        if (jobError) throw new Error(`Failed to store OpenAI resources: ${jobError.message}`);

        for (let index = 0; index < documentIds.length; index++) {
            const fileId = fileIds[index];
            if (!fileId) continue;
            const { error } = await this.supabase
                .from('analysis_job_documents')
                .update({ file_id: fileId })
                .eq('id', documentIds[index])
                .eq('job_id', jobId);
            if (error) throw new Error(`Failed to link OpenAI file ${fileId}: ${error.message}`);
        }
    }

    async updatePhase(jobId: string, phase: string, phaseResult?: unknown): Promise<void> {
        console.log(`[Job ${jobId}] Phase: ${phase}`);

        const { error } = await this.supabase.rpc('record_analysis_phase', {
            p_job_id: jobId,
            p_phase: phase,
            p_phase_result: phaseResult ?? null,
            p_document_map: phase === 'document_map' ? (phaseResult ?? null) : null,
        });
        if (error) throw new Error(`Failed to update job phase: ${error.message}`);
    }

    async setDocumentMap(jobId: string, documentMap: unknown): Promise<void> {
        const { error } = await this.supabase
            .from('analysis_jobs')
            .update({
                document_map: documentMap,
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
        if (error) throw new Error(`Failed to set document map: ${error.message}`);
    }

    async completeJob(jobId: string, result: unknown): Promise<void> {
        console.log(`[Job ${jobId}] Completed`);
        const { error } = await this.supabase
            .from('analysis_jobs')
            .update({
                status: 'completed',
                phase: 'completed',
                result,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
        if (error) throw new Error(`Failed to complete job: ${error.message}`);
    }

    async failJob(jobId: string, errorMsg: string): Promise<void> {
        console.error(`[Job ${jobId}] Failed:`, errorMsg);
        const { error } = await this.supabase
            .from('analysis_jobs')
            .update({
                status: 'failed',
                phase: 'failed',
                error: errorMsg,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
        if (error) throw new Error(`Failed to mark job as failed: ${error.message}`);
    }

    async markForCleanup(jobId: string, cleanupAt: string): Promise<void> {
        const { error } = await this.supabase.from('analysis_jobs').update({ cleanup_at: cleanupAt }).eq('id', jobId);
        if (error) throw new Error(`Failed to mark job for cleanup: ${error.message}`);
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
