/**
 * Edge Function: analysis-jobs
 *
 * Small authenticated control-plane API for Fase 1B:
 *   1. init   -> create the durable job and short-lived signed upload tokens
 *   2. submit -> verify Storage objects and enqueue ingestion_map
 *
 * Document bytes never cross this function.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limiter.ts';
import { ANALYSIS_RUNTIME_VERSIONS } from '../_shared/ai-runtime-version.ts';
import { MAX_PAYLOAD_BYTES } from '../_shared/config.ts';
import { JobService } from '../_shared/services/job.service.ts';
import {
    inferAnalysisMimeType,
    sanitizeStorageFilename,
    sha256Hex,
} from '../_shared/services/durable-input.service.ts';
import { getCleanupTimestamp } from '../analyze-with-agents/cleanup.ts';

const ANALYSIS_BUCKET = 'analysis-pdfs';
const MAX_CONTROL_BODY_BYTES = 256 * 1024;
const MAX_DOCUMENTS = 20;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,200}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
]);

interface UploadDescriptor {
    name: string;
    sizeBytes: number;
    mimeType?: string;
    sha256: string;
}

interface StoredDocument {
    id: string;
    file_name: string;
    storage_path: string;
    content_sha256: string;
    size_bytes: number;
    mime_type: string;
    upload_status: string;
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
}

function parseUploadDescriptors(value: unknown): UploadDescriptor[] {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_DOCUMENTS) {
        throw new Error(`Se requieren entre 1 y ${MAX_DOCUMENTS} documentos`);
    }

    const descriptors = value.map((raw, index) => {
        const file = (raw || {}) as Record<string, unknown>;
        const name = String(file.name || '')
            .normalize('NFKC')
            .trim();
        const sizeBytes = Number(file.sizeBytes);
        const sha256 = String(file.sha256 || '').toLowerCase();
        const mimeType = String(file.mimeType || inferAnalysisMimeType(name));

        if (!name || name.length > 255) {
            throw new Error(`Nombre no válido en el documento ${index + 1}`);
        }
        if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
            throw new Error(`Tamaño no válido en ${name}`);
        }
        if (!SHA256_PATTERN.test(sha256)) {
            throw new Error(`SHA-256 no válido en ${name}`);
        }
        if (!ALLOWED_MIME_TYPES.has(mimeType)) {
            throw new Error(`Tipo de archivo no permitido en ${name}`);
        }

        return { name, sizeBytes, sha256, mimeType };
    });

    const totalBytes = descriptors.reduce((sum, file) => sum + file.sizeBytes, 0);
    if (totalBytes > MAX_PAYLOAD_BYTES) {
        throw new Error(`Los documentos superan el máximo agregado de ${MAX_PAYLOAD_BYTES / 1024 / 1024}MB`);
    }

    return descriptors;
}

function normalizeTemplate(value: unknown): Record<string, unknown> | null {
    if (value == null) return null;
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('La plantilla no es válida');
    }
    const serialized = JSON.stringify(value);
    if (serialized.length > 64 * 1024) {
        throw new Error('La plantilla supera el máximo de 64KB');
    }
    return value as Record<string, unknown>;
}

async function createUploadPlan(input: {
    serviceClient: ReturnType<typeof createClient>;
    jobService: JobService;
    userId: string;
    idempotencyKey: string;
    files: UploadDescriptor[];
    template: Record<string, unknown> | null;
    supabaseUrl: string;
}): Promise<Record<string, unknown>> {
    const retentionUntil = getCleanupTimestamp();
    const fingerprint = await sha256Hex(
        JSON.stringify({
            files: input.files.map(({ name, sizeBytes, sha256, mimeType }) => ({
                name,
                sizeBytes,
                sha256,
                mimeType,
            })),
            template: input.template,
        })
    );

    const durableJob = await input.jobService.createDurableJob(
        input.userId,
        input.files[0].name,
        input.idempotencyKey,
        fingerprint,
        ANALYSIS_RUNTIME_VERSIONS,
        retentionUntil,
        {
            requestSource: 'analysis-jobs',
            template: input.template,
            documentCount: input.files.length,
        }
    );

    const workerUrl = `${input.supabaseUrl}/functions/v1/analysis-worker`;
    const { error: runtimeError } = await input.serviceClient
        .from('analysis_runtime_settings')
        .update({ worker_url: workerUrl, updated_at: new Date().toISOString() })
        .eq('singleton', true);
    if (runtimeError) {
        throw new Error(`No se pudo configurar el worker: ${runtimeError.message}`);
    }

    const { error: jobModeError } = await input.serviceClient
        .from('analysis_jobs')
        .update({ execution_mode: 'async_worker' })
        .eq('id', durableJob.jobId)
        .eq('user_id', input.userId);
    if (jobModeError) {
        throw new Error(`No se pudo configurar el job asíncrono: ${jobModeError.message}`);
    }

    let { data: documents, error: documentsError } = await input.serviceClient
        .from('analysis_job_documents')
        .select('id, file_name, storage_path, content_sha256, size_bytes, mime_type, upload_status')
        .eq('job_id', durableJob.jobId)
        .order('document_order', { ascending: true });
    if (documentsError) {
        throw new Error(`No se pudo recuperar el plan de subida: ${documentsError.message}`);
    }

    // The job RPC and document insert are separate transactions. If the first
    // request died between them, an idempotent retry repairs the missing plan
    // instead of leaving an unrecoverable pending job.
    if (!documents || documents.length === 0) {
        const rows = input.files.map((file, documentOrder) => {
            const id = crypto.randomUUID();
            return {
                id,
                job_id: durableJob.jobId,
                file_name: file.name,
                storage_path: `${input.userId}/${durableJob.jobId}/${id}-${sanitizeStorageFilename(file.name)}`,
                content_sha256: file.sha256,
                size_bytes: file.sizeBytes,
                mime_type: file.mimeType,
                retention_until: retentionUntil,
                upload_status: 'pending',
                document_order: documentOrder,
            };
        });

        const { error } = await input.serviceClient.from('analysis_job_documents').insert(rows);
        if (error) {
            throw new Error(`No se pudo registrar el plan de subida: ${error.message}`);
        }

        const retry = await input.serviceClient
            .from('analysis_job_documents')
            .select('id, file_name, storage_path, content_sha256, size_bytes, mime_type, upload_status')
            .eq('job_id', durableJob.jobId)
            .order('document_order', { ascending: true });
        if (retry.error) {
            throw new Error(`No se pudo recuperar el plan reparado: ${retry.error.message}`);
        }
        documents = retry.data;
    }

    if (!documents || documents.length !== input.files.length) {
        throw new Error('El plan durable de documentos está incompleto');
    }

    const job = await input.jobService.getJob(durableJob.jobId);
    const status = String(job?.status || 'pending');
    if (status === 'completed' || status === 'processing' || status === 'queued' || status === 'retrying') {
        return {
            jobId: durableJob.jobId,
            created: durableJob.created,
            status,
            uploads: [],
        };
    }

    const uploads = [];
    for (const document of (documents || []) as StoredDocument[]) {
        const { data, error } = await input.serviceClient.storage
            .from(ANALYSIS_BUCKET)
            .createSignedUploadUrl(document.storage_path, { upsert: true });
        if (error || !data?.token) {
            throw new Error(`No se pudo firmar la subida de ${document.file_name}: ${error?.message || 'sin token'}`);
        }
        uploads.push({
            documentId: document.id,
            name: document.file_name,
            path: data.path || document.storage_path,
            token: data.token,
            mimeType: document.mime_type,
            sizeBytes: document.size_bytes,
            sha256: document.content_sha256,
        });
    }

    return {
        jobId: durableJob.jobId,
        created: durableJob.created,
        status: 'awaiting_upload',
        uploads,
        uploadExpiresInSeconds: 7200,
    };
}

async function submitJob(input: {
    serviceClient: ReturnType<typeof createClient>;
    jobService: JobService;
    userId: string;
    jobId: string;
}): Promise<Record<string, unknown>> {
    if (!UUID_PATTERN.test(input.jobId)) throw new Error('jobId no válido');

    const { data: job, error: jobError } = await input.serviceClient
        .from('analysis_jobs')
        .select('id, status, error')
        .eq('id', input.jobId)
        .eq('user_id', input.userId)
        .maybeSingle();
    if (jobError) throw new Error(`No se pudo leer el job: ${jobError.message}`);
    if (!job) throw new Error('Job no encontrado');
    if (job.status === 'completed') return { jobId: job.id, status: 'completed' };
    if (['failed', 'cancelled', 'dead_letter'].includes(job.status)) {
        throw new Error(job.error || 'El job no admite reanudación');
    }

    const { data: documents, error: documentsError } = await input.serviceClient
        .from('analysis_job_documents')
        .select('id, file_name, storage_path, size_bytes')
        .eq('job_id', input.jobId)
        .order('document_order', { ascending: true });
    if (documentsError) {
        throw new Error(`No se pudieron leer los documentos: ${documentsError.message}`);
    }
    if (!documents || documents.length === 0) {
        throw new Error('El job no tiene documentos registrados');
    }

    const folder = `${input.userId}/${input.jobId}`;
    const { data: storedObjects, error: listError } = await input.serviceClient.storage
        .from(ANALYSIS_BUCKET)
        .list(folder, { limit: MAX_DOCUMENTS + 5 });
    if (listError) {
        throw new Error(`No se pudo verificar Storage: ${listError.message}`);
    }
    const storedNames = new Set((storedObjects || []).map((object) => object.name));

    for (const document of documents) {
        const objectName = String(document.storage_path).slice(folder.length + 1);
        if (!storedNames.has(objectName)) {
            throw new Error(`Falta completar la subida de ${document.file_name}`);
        }
    }

    const { error: uploadStateError } = await input.serviceClient
        .from('analysis_job_documents')
        .update({ upload_status: 'uploaded' })
        .eq('job_id', input.jobId)
        .in('upload_status', ['pending', 'uploaded']);
    if (uploadStateError) {
        throw new Error(`No se pudo confirmar la subida: ${uploadStateError.message}`);
    }

    await input.jobService.enqueueStep(input.jobId, 'ingestion_map', {
        documentCount: documents.length,
        runtimeVersion: ANALYSIS_RUNTIME_VERSIONS,
    });

    return { jobId: input.jobId, status: 'queued' };
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: getCorsHeaders(req) });
    }
    if (req.method !== 'POST') {
        return jsonResponse(req, { error: 'Método no permitido' }, 405);
    }

    try {
        const rawBody = await req.text();
        if (rawBody.length > MAX_CONTROL_BODY_BYTES) {
            return jsonResponse(req, { error: 'Payload de control demasiado grande' }, 413);
        }

        const body = JSON.parse(rawBody || '{}') as Record<string, unknown>;
        const action = String(body.action || '');
        if (!['init', 'submit'].includes(action)) {
            return jsonResponse(req, { error: 'Acción no válida' }, 400);
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        if (!supabaseUrl || !anonKey || !serviceRoleKey) {
            throw new Error('Runtime Supabase incompleto');
        }

        const authHeader = req.headers.get('authorization') || '';
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const {
            data: { user },
        } = await userClient.auth.getUser(token);
        if (!user) {
            return jsonResponse(req, { error: 'No se pudo resolver el usuario' }, 401);
        }

        const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const jobService = new JobService(serviceClient);

        if (action === 'init') {
            const rateCheck = checkRateLimit(`analysis-init:${user.id}`);
            if (!rateCheck.allowed) {
                return jsonResponse(
                    req,
                    {
                        error: 'Límite de análisis excedido. Inténtalo más tarde.',
                    },
                    429
                );
            }

            const idempotencyKey = (req.headers.get('x-idempotency-key') || '').trim();
            if (!IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
                return jsonResponse(req, { error: 'X-Idempotency-Key no válido' }, 400);
            }

            const result = await createUploadPlan({
                serviceClient,
                jobService,
                userId: user.id,
                idempotencyKey,
                files: parseUploadDescriptors(body.files),
                template: normalizeTemplate(body.template),
                supabaseUrl,
            });
            return jsonResponse(req, result, result.created ? 201 : 200);
        }

        const result = await submitJob({
            serviceClient,
            jobService,
            userId: user.id,
            jobId: String(body.jobId || ''),
        });
        return jsonResponse(req, result, 202);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error interno';
        const status = /no encontrado/i.test(message)
            ? 404
            : /no válido|requieren|falta|supera|permitido/i.test(message)
              ? 400
              : 500;
        console.error('[analysis-jobs] Request failed:', message);
        return jsonResponse(req, { error: message }, status);
    }
});
