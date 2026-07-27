/**
 * Application-wide constants
 */

/**
 * Maximum PDF file size in MB. This is the single source of truth for the
 * client-side per-file limit (there is no feature flag for it). The upload UI
 * also enforces a 30 MB aggregate limit; the async control plane has a 50 MB
 * defense-in-depth ceiling.
 */
export const MAX_PDF_SIZE_MB = 30;

/** Maximum PDF file size in bytes */
export const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

/** Supported file extensions */
export const ALLOWED_FILE_EXTENSIONS = ['.pdf'];
