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
 * OpenAI model used by the conversational layer (chat-with-analysis-agent).
 * 'gpt-5.4' is OpenAI's current frontier model (verified against
 * https://developers.openai.com/api/docs/models/gpt-5.4 on 2026-07-12).
 * Kept separate from OPENAI_MODEL: the chat manager relies on structured
 * outputs (outputType + Zod) over function tools, not file_search, so it can
 * track a newer tier than the extraction pipeline without re-validating the
 * 5-phase benchmark.
 */
export const CHAT_MODEL = 'gpt-5.4';

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
 * Maximum request body size for the conversational layer (64KB).
 * Chat requests carry a message + session metadata, never documents;
 * anything larger is abuse or a client bug.
 */
export const MAX_CHAT_PAYLOAD_BYTES = 64 * 1024;

/**
 * Chat rate limit (per user, sliding window of 1 hour).
 * Each message triggers a multi-agent run (manager + specialist tools), so
 * the budget guards OpenAI cost. 60/h ≈ one message per minute sustained,
 * generous for real conversations while bounding abuse.
 */
export const CHAT_MAX_REQUESTS_PER_HOUR = 60;

/**
 * Maximum concurrent block extractions in Phase C.
 * Kept deliberately below the total number of blocks to reduce OpenAI 429 bursts
 * on medium/large dossiers. Stability is preferred over the shortest possible
 * wall-clock time because retries are expensive inside a single SSE request.
 */
// 2 (antes 3): con file_search cada bloque consume mucho TPM y las cuentas con
// tier ajustado entraban en cascada de 429 con 3 bloques simultáneos. El coste
// es ~20-30s más de análisis; el beneficio, muchos menos reintentos visibles.
export const BLOCK_CONCURRENCY = 2;

/**
 * Backoff for transient failures (429 / 5xx) during block extraction.
 * One retry only, and the delay is capped so a single degraded block cannot
 * consume the whole PIPELINE_TIMEOUT_MS budget (a 60-120s Retry-After would).
 * Timeouts are NOT retried (see isRetryableError).
 */
export const BLOCK_MAX_RETRIES = 1;
export const BLOCK_RETRY_MAX_DELAY_MS = 30_000;

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
