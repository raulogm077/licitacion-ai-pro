/**
 * Job Service — manages analysis_jobs table for pipeline tracking.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.3';

export type AnalysisStepName = 'ingestion_map' | 'extraction' | 'consolidation' | 'validation';

export interface DurableJobCreation {
    jobId: string;
    created: boolean;
}

export interface ClaimedAnalysisStep {
    jobId: string;
    stepName: AnalysisStepName;
    payload: Record<string, unknown>;
    attemptCount: number;
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
        retentionUntil: string,
        metadata: Record<string, unknown> = {
            requestSource: 'analyze-with-agents',
        }
    ): Promise<DurableJobCreation> {
        const { data, error } = await this.supabase.rpc('create_analysis_job', {
            p_user_id: userId,
            p_filename: filename,
            p_idempotency_key: idempotencyKey,
            p_input_fingerprint: inputFingerprint,
            p_runtime_version: runtimeVersion,
            p_retention_until: retentionUntil,
            p_metadata: metadata,
        });

        if (error) {
            throw new Error(`Failed to create durable job: ${error.message}`);
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.job_id) {
            throw new Error('Failed to create durable job: missing job id');
        }
        return { jobId: row.job_id, created: row.created === true };
    }

    async getJob(jobId: string): Promise<Record<string, unknown> | null> {
        const { data, error } = await this.supabase
            .from('analysis_jobs')
            .select(
                'id, user_id, status, phase, result, error, vector_store_id, file_ids, document_map, phase_results, metadata, retention_until'
            )
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
        await this.enqueueStep(jobId, stepName, payload);

        const { data: claimed, error: claimError } = await this.supabase.rpc('claim_analysis_step', {
            p_job_id: jobId,
            p_step_name: stepName,
            p_worker_id: workerId,
            p_lease_seconds: leaseSeconds,
        });
        if (claimError) {
            throw new Error(`Failed to claim ${stepName}: ${claimError.message}`);
        }
        if (claimed !== true) {
            throw new Error(`Step ${stepName} is already owned by another worker`);
        }
    }

    async enqueueStep(jobId: string, stepName: AnalysisStepName, payload: Record<string, unknown> = {}): Promise<void> {
        const { error } = await this.supabase.rpc('enqueue_analysis_step', {
            p_job_id: jobId,
            p_step_name: stepName,
            p_payload: payload,
        });
        if (error) {
            throw new Error(`Failed to enqueue ${stepName}: ${error.message}`);
        }
    }

    async claimNextStep(workerId: string, leaseSeconds = 360): Promise<ClaimedAnalysisStep | null> {
        const { data, error } = await this.supabase.rpc('claim_next_analysis_step', {
            p_worker_id: workerId,
            p_lease_seconds: leaseSeconds,
        });
        if (error) {
            throw new Error(`Failed to claim next analysis step: ${error.message}`);
        }

        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.claimed_job_id) return null;
        return {
            jobId: row.claimed_job_id,
            stepName: row.claimed_step_name as AnalysisStepName,
            payload: (row.claimed_payload || {}) as Record<string, unknown>,
            attemptCount: Number(row.claimed_attempt_count || 0),
        };
    }

    async advanceStep(input: {
        jobId: string;
        stepName: AnalysisStepName;
        workerId: string;
        outputRef?: Record<string, unknown>;
        nextPayload?: Record<string, unknown>;
        finalResult?: Record<string, unknown> | null;
    }): Promise<string> {
        const { data, error } = await this.supabase.rpc('advance_analysis_step', {
            p_job_id: input.jobId,
            p_step_name: input.stepName,
            p_worker_id: input.workerId,
            p_output_ref: input.outputRef || {},
            p_next_payload: input.nextPayload || {},
            p_final_result: input.finalResult ?? null,
        });
        if (error) {
            throw new Error(`Failed to advance ${input.stepName}: ${error.message}`);
        }
        const transition = String(data || 'unknown');
        if (transition === 'lost_lease') {
            throw new Error(`Lost lease while advancing ${input.stepName}`);
        }
        return transition;
    }

    async yieldStep(
        jobId: string,
        stepName: AnalysisStepName,
        workerId: string,
        outputRef: Record<string, unknown> = {}
    ): Promise<void> {
        const { data, error } = await this.supabase.rpc('yield_analysis_step', {
            p_job_id: jobId,
            p_step_name: stepName,
            p_worker_id: workerId,
            p_output_ref: outputRef,
        });
        if (error) throw new Error(`Failed to yield ${stepName}: ${error.message}`);
        if (data !== true) throw new Error(`Lost lease while yielding ${stepName}`);
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
        if (error) {
            throw new Error(`Failed to complete ${stepName}: ${error.message}`);
        }
        if (completed !== true) {
            throw new Error(`Lost lease while completing ${stepName}`);
        }
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
        if (error) {
            throw new Error(`Failed to persist ${stepName} failure: ${error.message}`);
        }
        return String(data || 'failed');
    }

    async setExternalResources(
        jobId: string,
        vectorStoreId: string,
        fileIds: string[],
        documentIds: string[]
    ): Promise<void> {
        const { error } = await this.supabase.rpc('record_analysis_external_resources', {
            p_job_id: jobId,
            p_vector_store_id: vectorStoreId,
            p_file_ids: fileIds,
            p_document_ids: documentIds,
        });
        if (error) {
            throw new Error(`Failed to store OpenAI resources: ${error.message}`);
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
        if (error) {
            throw new Error(`Failed to mark job as failed: ${error.message}`);
        }
    }

    async markForCleanup(jobId: string, cleanupAt: string): Promise<void> {
        const { error } = await this.supabase
            .from('analysis_jobs')
            .update({
                cleanup_at: cleanupAt,
            })
            .eq('id', jobId);
        if (error) {
            throw new Error(`Failed to mark job for cleanup: ${error.message}`);
        }
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
