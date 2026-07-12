/**
 * Application-wide constants
 */

/**
 * Maximum PDF file size in MB. This is the single source of truth for the
 * client-side upload limit (there is no feature flag for it): the synchronous
 * SSE pipeline's payload/timeout budget is the real constraint, mirrored by
 * MAX_PAYLOAD_BYTES in supabase/functions/_shared/config.ts on the backend.
 */
export const MAX_PDF_SIZE_MB = 4;

/** Maximum PDF file size in bytes */
export const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

/** Supported file extensions */
export const ALLOWED_FILE_EXTENSIONS = ['.pdf'];
