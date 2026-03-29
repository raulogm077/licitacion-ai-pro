/**
 * Shared configuration constants for the analysis pipeline.
 * Centralizes values that were previously hardcoded across multiple files.
 */

/** OpenAI model used for all Responses API calls */
export const OPENAI_MODEL = 'gpt-4.1';

/** Per-API-call timeout in milliseconds (90s per individual call) */
export const API_CALL_TIMEOUT_MS = 90_000;

/** Global pipeline timeout in milliseconds (6 minutes) */
export const PIPELINE_TIMEOUT_MS = 360_000;

/** Maximum payload size in bytes (50MB) */
export const MAX_PAYLOAD_BYTES = 50 * 1024 * 1024;

/** Maximum concurrent block extractions in Phase C */
export const BLOCK_CONCURRENCY = 3;

/** Vector store indexing timeout in milliseconds */
export const VECTOR_STORE_TIMEOUT_MS = 90_000;

/** Guide excerpt length for system prompts (chars) */
export const GUIDE_EXCERPT_LENGTH = 4000;

/** Guide excerpt length for document map phase (chars) */
export const GUIDE_EXCERPT_MAP_LENGTH = 3000;

/** Guide excerpt length for custom template extraction (chars) */
export const GUIDE_EXCERPT_TEMPLATE_LENGTH = 2000;
