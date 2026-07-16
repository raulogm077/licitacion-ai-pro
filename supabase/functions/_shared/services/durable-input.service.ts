import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.3';

export interface EncodedAnalysisFile {
    name: string;
    base64: string;
}

export interface PersistedAnalysisDocument {
    id: string;
    fileName: string;
    storagePath: string;
    sha256: string;
    sizeBytes: number;
    mimeType: string;
}

const ANALYSIS_BUCKET = 'analysis-pdfs';

export function inferAnalysisMimeType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.docx')) {
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (lower.endsWith('.txt')) return 'text/plain';
    return 'application/pdf';
}

export function decodeAnalysisBase64(value: string): Uint8Array {
    const encoded = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
    if (!encoded.trim()) throw new Error('El documento no contiene datos base64');

    try {
        return Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    } catch {
        throw new Error('Uno de los documentos no tiene un formato base64 válido');
    }
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function sanitizeStorageFilename(filename: string): string {
    const basename = filename.normalize('NFKC').split(/[\\/]/).pop() || 'documento.pdf';
    const sanitized = basename
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .replace(/[^\p{L}\p{N}._-]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120);
    return sanitized || 'documento.pdf';
}

export async function persistAnalysisInputs(input: {
    supabase: SupabaseClient;
    userId: string;
    jobId: string;
    filename: string;
    pdfBase64?: string;
    files?: EncodedAnalysisFile[];
    retentionUntil: string;
}): Promise<PersistedAnalysisDocument[]> {
    const encodedFiles: EncodedAnalysisFile[] = [];
    if (input.pdfBase64) {
        encodedFiles.push({ name: input.filename || 'documento.pdf', base64: input.pdfBase64 });
    }
    for (const file of input.files || []) {
        if (file?.name && file?.base64) encodedFiles.push(file);
    }

    if (encodedFiles.length === 0) throw new Error('No hay documentos válidos para persistir');

    const uploadedPaths: string[] = [];
    const rows: Array<Record<string, unknown>> = [];
    const metadata: Omit<PersistedAnalysisDocument, 'id'>[] = [];

    try {
        for (const file of encodedFiles) {
            const bytes = decodeAnalysisBase64(file.base64);
            const mimeType = inferAnalysisMimeType(file.name);
            const sha256 = await sha256Hex(bytes);
            const storagePath = `${input.userId}/${input.jobId}/${crypto.randomUUID()}-${sanitizeStorageFilename(file.name)}`;

            const { error: uploadError } = await input.supabase.storage
                .from(ANALYSIS_BUCKET)
                .upload(storagePath, bytes, {
                    contentType: mimeType,
                    upsert: false,
                });
            if (uploadError) throw new Error(`No se pudo guardar ${file.name}: ${uploadError.message}`);

            uploadedPaths.push(storagePath);
            metadata.push({
                fileName: file.name,
                storagePath,
                sha256,
                sizeBytes: bytes.byteLength,
                mimeType,
            });
            rows.push({
                job_id: input.jobId,
                file_name: file.name,
                storage_path: storagePath,
                content_sha256: sha256,
                size_bytes: bytes.byteLength,
                mime_type: mimeType,
                retention_until: input.retentionUntil,
            });
        }

        const { data, error: insertError } = await input.supabase
            .from('analysis_job_documents')
            .insert(rows)
            .select('id');
        if (insertError) throw new Error(`No se pudo registrar la copia recuperable: ${insertError.message}`);
        if (!data || data.length !== metadata.length) {
            throw new Error('La copia recuperable no devolvió todos los documentos registrados');
        }

        return metadata.map((document, index) => ({ ...document, id: data[index].id }));
    } catch (error) {
        if (uploadedPaths.length > 0) {
            const { error: cleanupError } = await input.supabase.storage.from(ANALYSIS_BUCKET).remove(uploadedPaths);
            if (cleanupError) console.warn('[DurableInput] Storage rollback failed:', cleanupError.message);
        }
        throw error;
    }
}
