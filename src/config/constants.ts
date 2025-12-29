/**
 * Application-wide constants
 */

/** Maximum PDF file size in MB */
export const MAX_PDF_SIZE_MB = 10;

/** Maximum PDF file size in bytes */
export const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

/** Supported file extensions */
export const ALLOWED_FILE_EXTENSIONS = ['.pdf'];

/** LLM Provider Types */
export const LLM_PROVIDERS = {
    GEMINI: 'gemini',
    OPENAI: 'openai',
} as const;

export type LLMProvider = typeof LLM_PROVIDERS[keyof typeof LLM_PROVIDERS];
