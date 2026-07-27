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
| `EDGE_WALL_CLOCK_MS`         | 150 000   | El techo de la **plataforma**, no una elección nuestra. Free = 150s; Pro hasta 400s vía secret            |
| `PIPELINE_SHUTDOWN_MARGIN_MS` | 10 000   | Head-room para persistir el fallo y vaciar el evento SSE antes de que la plataforma corte                |
| `PIPELINE_TIMEOUT_MS`        | derivado  | `EDGE_WALL_CLOCK_MS - PIPELINE_SHUTDOWN_MARGIN_MS` (140s por defecto). **Nunca fijarlo a mano**          |
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

## El presupuesto tiene que caber bajo el techo de plataforma

Si `PIPELINE_TIMEOUT_MS` supera el techo real de la invocación, el guard de
código **no existe**: la plataforma mata el isolate de golpe y no corre el
`catch`, ni el `finally`, ni el propio `setTimeout` del pipeline. El paso se
queda en `running` y el job en `processing` para siempre. Pasó en producción el
2026-07-27 con 280s de presupuesto contra 150s de techo (`SPEC.md` §10.10).

Por eso el presupuesto se deriva y no se escribe a mano, y por eso subir el
Function Timeout en el Dashboard obliga a fijar también el secret
`EDGE_WALL_CLOCK_MS`: son dos mitades del mismo ajuste.

## Un lease expirado necesita quien lo recupere

`claim_analysis_step` solo admite `queued`/`retrying` y `fail_analysis_step`
exige seguir siendo dueño del lease. `reclaim_stale_analysis_steps` es el único
sitio autorizado a sacar un paso de `running` sin poseerlo, y solo con el lease
ya caducado — un lease vigente nunca se toca, para no matar trabajo en vuelo. Su
disparador es el barrido oportunista al inicio de cada `analyze-with-agents`.

**No amplíes ese barrido a los jobs `async_worker`.** Su consumidor
(`claim_next_analysis_step`, despertado por `recover_analysis_worker` vía
`pg_cron`) ya acepta un paso `running` con lease vencido y lo reanuda desde el
checkpoint, conservando los bloques ya extraídos. Dos escritores sobre el mismo
estado pueden marcar `retrying`, y escribir un `error` visible en la fila, sobre
un análisis que se está recuperando solo. El reparto es deliberado: el barrido
cubre la ruta inline y los jobs huérfanos; el consumidor cubre lo asíncrono.
