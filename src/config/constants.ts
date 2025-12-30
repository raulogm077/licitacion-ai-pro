/**
 * Application-wide constants
 */

/** Maximum PDF file size in MB */
export const MAX_PDF_SIZE_MB = 6;

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

/** OpenAI Models - Using GPT-5 mini (most economical GPT-5 family model) */
export const OPENAI_MODELS = {
    DEFAULT: 'gpt-5-mini',     // $0.25/1M input, $2/1M output (Dec 2025)
    STANDARD: 'gpt-5.2',       // $1.75/$14 (better reasoning, 7x cost)
    PRO: 'gpt-5.2-pro',        // $21/$168 (advanced tasks, 84x cost)
    // Legacy: 'gpt-4o-mini' ($0.15/$0.60, cheaper but older)
} as const;

/** Reading Modes for AI Analysis */
export const READING_MODES = {
    FULL: 'full',
    KEY_DATA: 'keydata',
} as const;

export type ReadingMode = typeof READING_MODES[keyof typeof READING_MODES];
