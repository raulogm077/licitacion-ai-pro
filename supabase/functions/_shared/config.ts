/**
 * Shared configuration constants for the analysis pipeline.
 * Centralizes values that were previously hardcoded across multiple files.
 */

/**
 * OpenAI model used for all Responses API calls.
 * 'gpt-4.1' is OpenAI's April 2025 GPT-4 refresh (released 2025-04-14).
 * It is a valid model ID in the OpenAI API as of 2026-04-09.
 *
 * DO NOT change this value without:
 *   1. Verifying the new model supports Responses API + file_search tool
 *   2. Running the full 5-phase pipeline smoke test
 *   3. Updating CHANGELOG.md with the model migration rationale
 */
export const OPENAI_MODEL = 'gpt-4.1';

/**
 * Per-API-call timeout in milliseconds (90s per individual block call).
 * Increased from 50s: large documents (50-300 pages) require more time for
 * OpenAI file_search to scan through more content per block.
 */
export const API_CALL_TIMEOUT_MS = 90_000;

/**
 * Global pipeline timeout in milliseconds (280s).
 * ⚠️  Requires Supabase Edge Function timeout ≥ 300s.
 *     Configure at: Dashboard → Project Settings → Edge Functions → Function Timeout.
 *     Free tier default is 150s — upgrade to Pro or increase the limit before
 *     this value takes effect. If the Supabase hard limit is lower than this
 *     value, the function will be killed abruptly (502) instead of sending a
 *     graceful SSE error to the client.
 *
 * Budget breakdown for a ~100-page document:
 *   Ingestion (upload + indexing): ~45s
 *   Document Map: ~20s
 *   Block Extraction (9 blocks, all concurrent): ~60-90s
 *   Consolidation + Validation: ~15s
 *   Total typical: ~140-170s  — worst case: ~250s
 */
export const PIPELINE_TIMEOUT_MS = 280_000;

/** Maximum payload size in bytes (50MB) */
export const MAX_PAYLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Maximum concurrent block extractions in Phase C.
 * Kept deliberately below the total number of blocks to reduce OpenAI 429 bursts
 * on medium/large dossiers. Stability is preferred over the shortest possible
 * wall-clock time because retries are expensive inside a single SSE request.
 */
export const BLOCK_CONCURRENCY = 3;

/**
 * Vector store indexing timeout in milliseconds (90s).
 * How long to wait for file_counts.in_progress === 0 before proceeding
 * with a potentially partial index. Large PDFs (>100 pages) can take 30-60s
 * to fully index; 300-page docs may approach or exceed this limit.
 */
export const VECTOR_STORE_TIMEOUT_MS = 90_000;

/** Guide excerpt length for system prompts (chars) */
export const GUIDE_EXCERPT_LENGTH = 4000;

/** Guide excerpt length for document map phase (chars) */
export const GUIDE_EXCERPT_MAP_LENGTH = 3000;

/** Guide excerpt length for custom template extraction (chars) */
export const GUIDE_EXCERPT_TEMPLATE_LENGTH = 2000;
