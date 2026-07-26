---
paths:
    - 'supabase/functions/**'
    - 'src/services/job.service.ts'
    - 'src/stores/analysis.store.ts'
---

# Pipeline Timeout Architecture

Fase 1A still executes the full pipeline in a single Supabase Edge Function invocation, but SSE is no longer the source of truth. The job, Storage copy, step ledger and PGMQ message survive a broken request; the current invocation acts as the transitional inline worker.
Constants in `_shared/config.ts` control the timing budget:

| Constant                     | Value     | Notes                                                                                                    |
| ---------------------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| `PIPELINE_TIMEOUT_MS`        | 280 000   | Requires Supabase function timeout ≥ 300s (set in Dashboard → Project Settings → Edge Functions)         |
| `API_CALL_TIMEOUT_MS`        | 90 000    | Per-block agent run — no retry on timeout (timeouts are NOT retried, see `isRetryableError`)             |
| `BLOCK_CONCURRENCY`          | 2         | Bajada de 3→2 (2026-07-12): con file_search cada bloque consume mucho TPM y 3 simultáneos disparaban 429 |
| `BLOCK_MAX_RETRIES`          | 1         | Real backoff (`retryWithBackoff`) on 429/5xx per block — timeouts still NOT retried                      |
| `BLOCK_RETRY_MAX_DELAY_MS`   | 30 000    | Caps `Retry-After` so one degraded block can't consume the whole `PIPELINE_TIMEOUT_MS` budget            |
| `VECTOR_STORE_TIMEOUT_MS`    | 90 000    | Waits for `file_counts.in_progress === 0`, not `vs.status`                                               |
| `CHAT_MODEL`                 | `gpt-5.4` | Conversational layer model (chat), separate from the extraction `OPENAI_MODEL`                           |
| `CHAT_MAX_REQUESTS_PER_HOUR` | 60        | Per-user rate limit for `chat-with-analysis-agent` (`checkRateLimit`, namespaced `chat:`)                |
| `MAX_CHAT_PAYLOAD_BYTES`     | 64 KB     | Real body-size cap for chat; `analyze-with-agents` validates real body length too                        |

**Typical timing by document size:**

| Pages | Ingestion | Extraction | Total                                  |
| ----- | --------- | ---------- | -------------------------------------- |
| ~30   | ~20s      | ~30-50s    | ~70-90s ✅                             |
| ~100  | ~40s      | ~50-80s    | ~120-150s ✅                           |
| ~300  | ~90s      | ~60-90s    | ~200-250s ⚠️ needs 300s Supabase limit |

**⚠️ Remaining limitation for very large documents (300+ pages):** the worker is
still inline and therefore keeps the Supabase wall-clock ceiling. Fase 1B must
separate the queue consumer and signed upload endpoint; the durable schema,
`jobId` polling and retry semantics introduced in Fase 1A remain unchanged.
