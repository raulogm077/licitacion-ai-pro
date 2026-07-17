/**
 * Edge Function: analysis-worker
 *
 * Internal single-message consumer for the analysis_steps queue. Invocation is
 * authenticated with a random token generated inside Postgres and kept in
 * Vault. Each run claims one durable step, checkpoints its full reusable output
 * and atomically dispatches the next step before returning.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import OpenAI from 'npm:openai@6.33.0';
import { setTraceProcessors } from '../_shared/agents/sdk.ts';
import { SupabaseLogTraceProcessor } from '../_shared/agents/tracing.ts';
import { createPipelineContext } from '../_shared/agents/context.ts';
import { type AnalysisStepName, JobService } from '../_shared/services/job.service.ts';
import { sha256Hex } from '../_shared/services/durable-input.service.ts';
import { mapOpenAIError } from '../_shared/utils/error.utils.ts';
import { runIngestion, waitForVectorStoreIndexing } from '../analyze-with-agents/phases/ingestion.ts';
import { runDocumentMap } from '../analyze-with-agents/phases/document-map.ts';
import { runBlockExtraction } from '../analyze-with-agents/phases/block-extraction.ts';
import { runConsolidation } from '../analyze-with-agents/phases/consolidation.ts';
import { runValidation } from '../analyze-with-agents/phases/validation.ts';
import { cleanupJobResources, runOpportunisticCleanup } from '../analyze-with-agents/cleanup.ts';
import { GUIDE_CONTENT } from '../analyze-with-agents/guide-content.ts';
import { BLOCK_NAMES } from '../_shared/schemas/blocks.ts';

const ANALYSIS_BUCKET = 'analysis-pdfs';
const WORKER_LEASE_SECONDS = 155;
const EXTRACTION_BLOCKS_PER_SLICE = 2;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada');

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
setTraceProcessors([new SupabaseLogTraceProcessor()]);

interface AnalysisDocumentRow {
    id: string;
    file_name: string;
    storage_path: string;
    content_sha256: string;
    size_bytes: number;
    mime_type: string;
    file_id?: string | null;
    upload_status: string;
    document_order: number;
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function timingSafeEqualHex(left: string, right: string): boolean {
    if (left.length !== right.length) return false;
    let mismatch = 0;
    for (let index = 0; index < left.length; index++) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return mismatch === 0;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function retryDelaySeconds(attemptCount: number): number {
    const exponential = Math.min(300, 15 * 2 ** Math.max(0, attemptCount - 1));
    return exponential + Math.floor(Math.random() * 6);
}

async function loadDocuments(serviceClient: ReturnType<typeof createClient>, jobId: string) {
    const { data, error } = await serviceClient
        .from('analysis_job_documents')
        .select(
            'id, file_name, storage_path, content_sha256, size_bytes, mime_type, file_id, upload_status, document_order'
        )
        .eq('job_id', jobId)
        .order('document_order', { ascending: true });
    if (error) throw new Error(`Failed to load job documents: ${error.message}`);
    if (!data || data.length === 0) {
        throw new Error('El job no tiene documentos recuperables');
    }
    return data as AnalysisDocumentRow[];
}

async function downloadAndVerifyDocuments(
    serviceClient: ReturnType<typeof createClient>,
    jobId: string,
    documents: AnalysisDocumentRow[]
) {
    const sourceFiles: Array<{ name: string; data: Blob; mimeType: string }> = [];

    for (const document of documents) {
        const { data, error } = await serviceClient.storage.from(ANALYSIS_BUCKET).download(document.storage_path);
        if (error || !data) {
            throw new Error(`No se pudo recuperar ${document.file_name}: ${error?.message || 'sin datos'}`);
        }

        const bytes = new Uint8Array(await data.arrayBuffer());
        if (bytes.byteLength !== Number(document.size_bytes)) {
            throw new Error(`El tamaño almacenado no coincide para ${document.file_name}`);
        }
        const actualSha256 = await sha256Hex(bytes);
        if (!timingSafeEqualHex(actualSha256, document.content_sha256)) {
            await serviceClient
                .from('analysis_job_documents')
                .update({ upload_status: 'failed' })
                .eq('id', document.id)
                .eq('job_id', jobId);
            throw new Error(`La integridad SHA-256 no coincide para ${document.file_name}`);
        }

        const blob = new Blob([bytes], { type: document.mime_type });
        sourceFiles.push({
            name: document.file_name,
            data: blob,
            mimeType: document.mime_type,
        });
        const { error: verifiedError } = await serviceClient
            .from('analysis_job_documents')
            .update({
                upload_status: 'verified',
                verified_at: new Date().toISOString(),
            })
            .eq('id', document.id)
            .eq('job_id', jobId);
        if (verifiedError) {
            throw new Error(`No se pudo verificar ${document.file_name}: ${verifiedError.message}`);
        }
    }

    return sourceFiles;
}

async function processIngestionMap(input: {
    serviceClient: ReturnType<typeof createClient>;
    jobService: JobService;
    workerId: string;
    job: Record<string, unknown>;
    documents: AnalysisDocumentRow[];
}) {
    const jobId = String(input.job.id);
    const phaseResults = asRecord(input.job.phase_results);
    const metadata = asRecord(input.job.metadata);
    const template = metadata.template && typeof metadata.template === 'object' ? metadata.template : null;
    const fileNames = input.documents.map((document) => document.file_name);
    let vectorStoreId = String(input.job.vector_store_id || '');
    let fileIds = Array.isArray(input.job.file_ids) ? (input.job.file_ids as string[]) : [];
    let ingestionCheckpoint = asRecord(phaseResults.ingestion);
    let ingestionWorkPerformed = false;

    if (!vectorStoreId || fileIds.length === 0) {
        const sourceFiles = await downloadAndVerifyDocuments(input.serviceClient, jobId, input.documents);
        const ingestion = await runIngestion({
            openai,
            filename: fileNames[0] || 'documento.pdf',
            sourceFiles,
            onResourcesCreated: async (resources) => {
                await input.jobService.setExternalResources(
                    jobId,
                    resources.vectorStoreId,
                    resources.fileIds,
                    input.documents.map((document) => document.id)
                );
            },
        });
        vectorStoreId = ingestion.vectorStoreId;
        fileIds = ingestion.fileIds;
        ingestionCheckpoint = {
            fileNames: ingestion.fileNames,
            diagnostics: ingestion.diagnostics,
        };
        await input.jobService.updatePhase(jobId, 'ingestion', ingestionCheckpoint);
        ingestionWorkPerformed = true;
    } else if (!ingestionCheckpoint.diagnostics) {
        const diagnostics = await waitForVectorStoreIndexing(openai, vectorStoreId);
        ingestionCheckpoint = { fileNames, diagnostics };
        await input.jobService.updatePhase(jobId, 'ingestion', ingestionCheckpoint);
        ingestionWorkPerformed = true;
    }

    if (ingestionWorkPerformed) {
        await input.jobService.yieldStep(jobId, 'ingestion_map', input.workerId, {
            vectorStoreId,
            fileIds,
            checkpoint: 'ingestion',
        });
        return 'ingestion_map';
    }

    let documentMap = input.job.document_map || phaseResults.document_map;
    if (!documentMap) {
        const context = createPipelineContext({
            vectorStoreId,
            fileNames: (ingestionCheckpoint.fileNames as string[]) || fileNames,
            guideExcerpt: '',
            userId: String(input.job.user_id),
            requestId: input.workerId,
            customTemplate: template,
        });
        documentMap = await runDocumentMap({
            context,
            guideContent: GUIDE_CONTENT,
        });
        await input.jobService.updatePhase(jobId, 'document_map', documentMap);
    }

    return await input.jobService.advanceStep({
        jobId,
        stepName: 'ingestion_map',
        workerId: input.workerId,
        outputRef: {
            vectorStoreId,
            fileIds,
            documentCount: Array.isArray((documentMap as Record<string, unknown>).documentos)
                ? ((documentMap as Record<string, unknown>).documentos as unknown[]).length
                : 0,
        },
        nextPayload: { vectorStoreId },
    });
}

async function processExtraction(input: {
    jobService: JobService;
    workerId: string;
    job: Record<string, unknown>;
    documents: AnalysisDocumentRow[];
}) {
    const jobId = String(input.job.id);
    const phaseResults = asRecord(input.job.phase_results);
    const metadata = asRecord(input.job.metadata);
    const vectorStoreId = String(input.job.vector_store_id || '');
    if (!vectorStoreId || !input.job.document_map) {
        throw new Error('Falta el checkpoint de ingesta/mapa');
    }

    let extraction = asRecord(phaseResults.extraction);
    const template = metadata.template && typeof metadata.template === 'object' ? metadata.template : null;
    const context = createPipelineContext({
        vectorStoreId,
        fileNames: input.documents.map((document) => document.file_name),
        guideExcerpt: '',
        userId: String(input.job.user_id),
        requestId: input.workerId,
        customTemplate: template,
    });
    extraction = await runBlockExtraction({
        openai,
        vectorStoreId,
        documentMap: input.job.document_map,
        guideContent: GUIDE_CONTENT,
        template,
        context,
        resume: extraction,
        onCheckpoint: async (checkpoint) => {
            extraction = checkpoint;
            await input.jobService.updatePhase(jobId, 'extraction', checkpoint);
        },
        maxNewBlocks: EXTRACTION_BLOCKS_PER_SLICE,
    });
    // Also persists the no-op resume case where every block already existed.
    await input.jobService.updatePhase(jobId, 'extraction', extraction);

    const extractedBlocks = Array.isArray(extraction.blocks) ? extraction.blocks : [];
    const requiresCustomTemplate = Boolean(
        template &&
        Array.isArray((template as { schema?: unknown }).schema) &&
        (template as { schema: unknown[] }).schema.length > 0
    );
    const templateComplete =
        !requiresCustomTemplate || extraction.customTemplate !== undefined || extraction.templateWarning !== undefined;
    if (extractedBlocks.length < BLOCK_NAMES.length || !templateComplete) {
        await input.jobService.yieldStep(jobId, 'extraction', input.workerId, {
            blockCount: extractedBlocks.length,
            templateComplete,
        });
        return 'extraction';
    }

    return await input.jobService.advanceStep({
        jobId,
        stepName: 'extraction',
        workerId: input.workerId,
        outputRef: {
            blockCount: extractedBlocks.length,
            diagnostics: extraction.diagnostics || {},
        },
        nextPayload: { blockCount: extractedBlocks.length },
    });
}

async function processConsolidation(input: { jobService: JobService; workerId: string; job: Record<string, unknown> }) {
    const jobId = String(input.job.id);
    const phaseResults = asRecord(input.job.phase_results);
    const extraction = asRecord(phaseResults.extraction);
    if (!Array.isArray(extraction.blocks)) {
        throw new Error('Falta el checkpoint de extracción');
    }

    let consolidated = asRecord(phaseResults.consolidation);
    if (!consolidated.result) {
        consolidated = runConsolidation({
            blocks: extraction.blocks,
            customTemplate:
                extraction.customTemplate && typeof extraction.customTemplate === 'object'
                    ? (extraction.customTemplate as Record<string, unknown>)
                    : undefined,
        });
        await input.jobService.updatePhase(jobId, 'consolidation', consolidated);
    }

    return await input.jobService.advanceStep({
        jobId,
        stepName: 'consolidation',
        workerId: input.workerId,
        outputRef: { consolidated: true },
        nextPayload: { consolidated: true },
    });
}

async function processValidation(input: { jobService: JobService; workerId: string; job: Record<string, unknown> }) {
    const jobId = String(input.job.id);
    const phaseResults = asRecord(input.job.phase_results);
    const consolidated = asRecord(phaseResults.consolidation);
    const extraction = asRecord(phaseResults.extraction);
    const ingestion = asRecord(phaseResults.ingestion);
    if (!consolidated.result) {
        throw new Error('Falta el checkpoint de consolidación');
    }

    let workflow = phaseResults.validation;
    let finalResult: Record<string, unknown>;
    if (workflow && typeof workflow === 'object') {
        finalResult = { result: consolidated.result, workflow };
    } else {
        const validation = runValidation({
            consolidated,
            ingestion: asRecord(ingestion.diagnostics),
            extraction: asRecord(extraction.diagnostics),
        });
        workflow = validation.workflow;
        finalResult = { result: validation.result, workflow: validation.workflow };
        await input.jobService.updatePhase(jobId, 'validation', workflow);
    }

    return await input.jobService.advanceStep({
        jobId,
        stepName: 'validation',
        workerId: input.workerId,
        outputRef: {
            quality: asRecord(asRecord(workflow).quality).overall || null,
        },
        finalResult,
    });
}

async function cleanupExpiredJobs(serviceClient: ReturnType<typeof createClient>) {
    return await runOpportunisticCleanup(
        openai,
        async () => {
            const { data } = await serviceClient
                .from('analysis_jobs')
                .select('id, status, vector_store_id, file_ids')
                .lt('cleanup_at', new Date().toISOString())
                .in('status', ['pending', 'completed', 'failed', 'cancelled', 'dead_letter'])
                .limit(3);
            return data || [];
        },
        async (job) => {
            if (job.status === 'pending') {
                const { error: abandonedJobError } = await serviceClient
                    .from('analysis_jobs')
                    .update({
                        status: 'failed',
                        phase: 'failed',
                        error: 'El plan de subida expiró antes de iniciar el análisis',
                        completed_at: new Date().toISOString(),
                    })
                    .eq('id', job.id)
                    .eq('status', 'pending');
                if (abandonedJobError) throw abandonedJobError;
            }

            const { data: documents, error: documentsError } = await serviceClient
                .from('analysis_job_documents')
                .select('storage_path')
                .eq('job_id', job.id);
            if (documentsError) throw documentsError;

            const storagePaths = (documents || [])
                .map((document) => document.storage_path)
                .filter((path): path is string => typeof path === 'string' && path.length > 0);
            if (storagePaths.length > 0) {
                const { error: storageError } = await serviceClient.storage.from(ANALYSIS_BUCKET).remove(storagePaths);
                if (storageError) throw storageError;
            }

            const { error: documentDeleteError } = await serviceClient
                .from('analysis_job_documents')
                .delete()
                .eq('job_id', job.id);
            if (documentDeleteError) throw documentDeleteError;

            const { error: jobCleanupError } = await serviceClient
                .from('analysis_jobs')
                .update({ vector_store_id: null, file_ids: null })
                .eq('id', job.id);
            if (jobCleanupError) throw jobCleanupError;
        }
    );
}

serve(async (req: Request) => {
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) {
        return json({ error: 'Runtime Supabase incompleto' }, 500);
    }

    const workerToken = req.headers.get('x-analysis-worker-token') || '';
    if (workerToken.length < 32 || workerToken.length > 256) {
        return json({ error: 'No autorizado' }, 401);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: runtimeSettings, error: settingsError } = await serviceClient
        .from('analysis_runtime_settings')
        .select('worker_token_sha256')
        .eq('singleton', true)
        .single();
    if (settingsError || !runtimeSettings) {
        return json({ error: 'No autorizado' }, 401);
    }

    const suppliedHash = await sha256Hex(workerToken);
    if (!timingSafeEqualHex(suppliedHash, runtimeSettings.worker_token_sha256)) {
        return json({ error: 'No autorizado' }, 401);
    }

    let mode = 'work';
    try {
        const body = await req.json();
        if (body?.mode === 'cleanup') mode = 'cleanup';
    } catch {
        // Empty/malformed bodies stay in normal work mode; auth has already run.
    }
    if (mode === 'cleanup') {
        const cleaned = await cleanupExpiredJobs(serviceClient);
        return json({ cleaned });
    }

    const workerId = `worker:${crypto.randomUUID()}`;
    const jobService = new JobService(serviceClient);
    let claimed;

    try {
        claimed = await jobService.claimNextStep(workerId, WORKER_LEASE_SECONDS);
        if (!claimed) {
            await cleanupExpiredJobs(serviceClient);
            return new Response(null, { status: 204 });
        }

        const job = await jobService.getJob(claimed.jobId);
        if (!job) throw new Error('El job reclamado ya no existe');
        const documents = await loadDocuments(serviceClient, claimed.jobId);

        let transition: string;
        switch (claimed.stepName) {
            case 'ingestion_map':
                transition = await processIngestionMap({
                    serviceClient,
                    jobService,
                    workerId,
                    job,
                    documents,
                });
                break;
            case 'extraction':
                transition = await processExtraction({
                    jobService,
                    workerId,
                    job,
                    documents,
                });
                break;
            case 'consolidation':
                transition = await processConsolidation({ jobService, workerId, job });
                break;
            case 'validation':
                transition = await processValidation({ jobService, workerId, job });
                break;
            default:
                throw new Error(`Paso no soportado: ${claimed.stepName}`);
        }

        console.log(
            `[analysis-worker] job=${claimed.jobId} step=${claimed.stepName} attempt=${claimed.attemptCount} transition=${transition}`
        );
        return json({
            processed: true,
            jobId: claimed.jobId,
            step: claimed.stepName,
            transition,
        });
    } catch (error) {
        const message = mapOpenAIError(error);
        console.error('[analysis-worker] Step failed:', {
            jobId: claimed?.jobId,
            step: claimed?.stepName,
            error: message,
        });

        if (claimed) {
            try {
                const state = await jobService.failStep(
                    claimed.jobId,
                    claimed.stepName as AnalysisStepName,
                    workerId,
                    message,
                    retryDelaySeconds(claimed.attemptCount)
                );
                if (state === 'dead_letter') {
                    const job = await jobService.getJob(claimed.jobId);
                    const cleaned = await cleanupJobResources(
                        openai,
                        String(job?.vector_store_id || '') || null,
                        Array.isArray(job?.file_ids) ? (job?.file_ids as string[]) : null
                    );
                    if (cleaned) {
                        const { error: cleanupStateError } = await serviceClient
                            .from('analysis_jobs')
                            .update({ vector_store_id: null, file_ids: null })
                            .eq('id', claimed.jobId);
                        if (cleanupStateError) {
                            console.error(
                                '[analysis-worker] Failed to persist dead-letter cleanup state:',
                                cleanupStateError
                            );
                        }
                    }
                }
                return json(
                    {
                        processed: false,
                        jobId: claimed.jobId,
                        step: claimed.stepName,
                        state,
                    },
                    500
                );
            } catch (persistenceError) {
                console.error('[analysis-worker] Failure persistence failed:', persistenceError);
            }
        }

        return json({ error: message }, 500);
    }
});
