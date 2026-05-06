/**
 * Schema del Estado del Job de Análisis
 *
 * Define la estructura para tracking de jobs en analysis_jobs.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { z } from 'npm:zod@3.25.76';

export const JobPhaseEnum = z.enum([
    'pending',
    'ingestion',
    'document_map',
    'extraction',
    'consolidation',
    'validation',
    'completed',
    'failed',
    'partial',
]);

export const JobStatusEnum = z.enum(['pending', 'processing', 'completed', 'failed']);

export const AnalysisJobSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    status: JobStatusEnum,
    phase: JobPhaseEnum.default('pending'),
    vector_store_id: z.string().optional().nullable(),
    file_ids: z.array(z.string()).default([]),
    phase_results: z.record(z.any()).default({}),
    document_map: z.any().optional().nullable(),
    result: z.any().optional().nullable(),
    error: z.string().optional().nullable(),
    metadata: z.record(z.any()).default({}),
    cleanup_at: z.string().optional().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
});

export type AnalysisJob = z.infer<typeof AnalysisJobSchema>;
export type JobPhase = z.infer<typeof JobPhaseEnum>;
export type JobStatus = z.infer<typeof JobStatusEnum>;
