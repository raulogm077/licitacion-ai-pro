const DEFAULT_MAX_PDF_BYTES = 10 * 1024 * 1024;

export function validatePdfSize(size: number, maxBytes = DEFAULT_MAX_PDF_BYTES) {
    if (!Number.isFinite(size) || size < 0) {
        throw new Error('Tamaño de archivo inválido.');
    }
    if (size > maxBytes) {
        throw new Error(`El PDF supera el límite permitido (${Math.round(maxBytes / 1024 / 1024)}MB).`);
    }
}

export function validateBase64Size(base64: string, maxBytes: number) {
    if (!base64) {
        throw new Error('Contenido base64 vacío.');
    }
    if (base64.length > maxBytes) {
        throw new Error('El contenido base64 supera el límite permitido.');
    }
}
