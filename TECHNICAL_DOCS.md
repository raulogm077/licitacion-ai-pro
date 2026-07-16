# Documentación Técnica — Analista de Pliegos

> Versión: 2.7.0 | Fecha: 2026-07-12

---

## Índice

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Backend — Edge Functions](#4-backend--edge-functions)
5. [Auth y postura de seguridad](#5-auth-y-postura-de-seguridad)
6. [Tracing y observabilidad](#6-tracing-y-observabilidad)
7. [API Reference](#7-api-reference)
8. [Deploy](#8-deploy)
9. [Testing](#9-testing)

---

## 1. Visión General

**Analista de Pliegos** es una aplicación SaaS que analiza documentos PDF de licitaciones públicas usando inteligencia artificial. Las fases B y C del pipeline `analyze-with-agents` se ejecutan vía el SDK `@openai/agents@0.3.1`. La capa conversacional `chat-with-analysis-agent` opera sobre análisis persistidos.

Ambas Edge Functions usan `verify_jwt = true` (gateway-side auth). Detalle en §5.

---

## 2. Arquitectura del Sistema

Ver `ARCHITECTURE.md` para el diagrama completo y los componentes principales.

### Flujo de análisis (Pipeline por Fases)

```
Usuario sube PDF
       → Frontend convierte a Base64
       → POST /functions/v1/analyze-with-agents
         (Authorization: Bearer <JWT>)
       → Kong API Gateway: verify_jwt = true → 401 si falta JWT
       → Edge Function: resolver user (auth.getUser) + rate limit (10/hora)
       → Fase A: Ingesta (Files API + Vector Store)
       → Fase B: Mapa Documental (Agent + run() + file_search)
       → Fase C: Extracción por Bloques (~9 Agents, 3 en paralelo + retries)
       → Fase D: Consolidación (sin LLM)
       → Fase E: Validación (sin LLM)
       → SSE streaming → cliente
       → Frontend valida con Zod, persiste en `licitaciones`
```

---

## 3. Stack Tecnológico

| Capa        | Tech                                                                             | Versión                                       |
| ----------- | -------------------------------------------------------------------------------- | --------------------------------------------- |
| Frontend    | React + TypeScript + Vite + Tailwind + Zustand                                   | 18.2 / 5.5 / 7.3 / 3.4 / 5.0                  |
| UI (Iris)   | motion (LazyMotion) + sonner + recharts + canvas-confetti + @fontsource-variable | solo-cliente (bundle Vite; no afectan a Deno) |
| Validación  | Zod                                                                              | 3.25.76 (alineado con `@openai/agents@0.3.1`) |
| Backend     | Supabase Edge Functions (Deno)                                                   | 2.x                                           |
| AI Pipeline | `@openai/agents`                                                                 | 0.3.1                                         |
| Subyacente  | OpenAI Responses API + Files API + Vector Store                                  | latest                                        |
| DB          | PostgreSQL                                                                       | 15+                                           |
| Hosting     | Vercel + Supabase Cloud                                                          | latest                                        |

---

## 4. Backend — Edge Functions

### `analyze-with-agents`

**Archivo**: `supabase/functions/analyze-with-agents/index.ts`

**Auth model**: `verify_jwt = true` en `supabase/config.toml`. El gateway rechaza requests sin JWT válido con 401 antes de invocar la función. El handler sólo resuelve `user` para rate-limit y ownership. El bloque de auth manual fue eliminado en M3.

**Pipeline**: 5 fases. B y C vía `Agent` + `run()` (camino único tras la eliminación del legacy fallback el 2026-05-09); D y E sin LLM. Detalle en `ARCHITECTURE.md`.

### `chat-with-analysis-agent`

**Archivo**: `supabase/functions/chat-with-analysis-agent/index.ts`

**Auth model**: `verify_jwt = true` en `supabase/config.toml` (desde 2026-05-09, mismo patrón que `analyze-with-agents`). El handler retira el bloque "if (!token) → 401"; se queda con `supabase.auth.getUser(token)` para resolver el `user` que se necesita para ownership contra `licitaciones` / `analysis_chat_sessions`, y conserva un `if (!user) → 401` defensivo.

**Límites (desde 2026-07-12)**: rate limiting por usuario `CHAT_MAX_REQUESTS_PER_HOUR=60` (`checkRateLimit` parametrizable con clave namespaced `chat:`/`analyze:`) y tope de payload real `MAX_CHAT_PAYLOAD_BYTES=64KB` (valida el tamaño real del body, no el header `content-length`). El modelo es la constante `CHAT_MODEL` (`_shared/config.ts`, no hardcodeado) y el SDK se importa solo vía `_shared/agents/sdk.ts` (0.3.1), que re-exporta también `tool`, `user` y `AgentInputItem`.

**Comportamiento**:

```
1. Validar CORS
2. Resolver user desde JWT (auth.getUser)
3. Validar body (Zod): analysisHash + message + sessionId?
4. assertAnalysisExists(): existencia del análisis (RLS → ownership implícito)
5. ensureSession(): crear o validar sessionId
6. Cargar historial conversacional desde analysis_chat_messages
7. Ejecutar manager agent con specialists vía agent.asTool()
8. Reescribir historial persistido con result.history
9. Devolver { answer, citations, usedTools, sessionId }
```

### Utilidades compartidas (`supabase/functions/_shared/`)

| Archivo                | Función                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `agents/sdk.ts`        | Re-export nombrado explícito de `@openai/agents@0.3.1`                                              |
| `agents/context.ts`    | `PipelineContext` + `createPipelineContext()`                                                       |
| `agents/guardrails.ts` | `jsonShapeGuardrail<T>` + `templateSanitizationGuardrail` + parsers                                 |
| `agents/tracing.ts`    | `SupabaseLogTraceProcessor`                                                                         |
| `config.ts`            | Constantes (`OPENAI_MODEL`, `CHAT_MODEL`, timeouts, concurrencia, backoff, límites de payload/rate) |
| `cors.ts`              | Whitelist de orígenes                                                                               |
| `rate-limiter.ts`      | `checkRateLimit` parametrizable con clave namespaced: `analyze:` 10/h, `chat:` 60/h por usuario     |
| `utils/concurrency.ts` | `runWithConcurrency` (compartida entre ingestion y block-extraction)                                |
| `utils/retry.ts`       | `retryWithBackoff` con `maxDelayMs` (backoff real 429/5xx en Fase C)                                |
| `schemas/canonical.ts` | Schema canónico con TrackedField (zod 3.25.76)                                                      |
| `utils/error.utils.ts` | Mapeo de errores OpenAI + `Input/OutputGuardrailTripwireTriggered`                                  |
| `utils/timeout.ts`     | `callWithTimeout` con `Promise.race` (90s por `run()`)                                              |

---

## 5. Auth y postura de seguridad

Desde 2026-05-09, **ambas** Edge Functions usan `verify_jwt = true`:

```toml
[functions.analyze-with-agents]
verify_jwt = true

[functions.chat-with-analysis-agent]
verify_jwt = true
```

### Reglas duras

- el gateway de Supabase rechaza con 401 las peticiones sin JWT válido **antes** de invocar la función
- los handlers NO contienen el bloque "if (!token) → 401"; eso lo hace el gateway
- los handlers sí siguen llamando a `supabase.auth.getUser(token)` para resolver el `user` necesario para ownership y rate-limit
- el comando `supabase functions deploy <name>` NO debe llevar `--no-verify-jwt`. El flag sobrescribe `config.toml` y deja la función abierta, lo que rompe la postura silenciosamente
- el job `Smoke Test` del workflow valida tras cada deploy a `main` que un POST sin `Authorization` recibe 401 desde el gateway en ambas funciones; si una falla, el deploy falla

### Smoke test post-deploy

```bash
# Ambas deben responder 401 desde el gateway
curl -i -X POST "$SUPABASE_URL/functions/v1/analyze-with-agents" \
  -H 'Content-Type: application/json' \
  -d '{"pdfBase64":""}'

curl -i -X POST "$SUPABASE_URL/functions/v1/chat-with-analysis-agent" \
  -H 'Content-Type: application/json' \
  -d '{"analysisHash":"x","message":"x"}'
```

### Rollback de auth

Si una de las funciones empieza a rechazar peticiones legítimas, fijar `verify_jwt = false` en `[functions.<nombre>]` de `config.toml` y redeployar con `--no-verify-jwt`. NUNCA hacer un cambio sin el otro: un mismatch entre `config.toml` y el comando deja la postura indefinida.

### RPC `search_licitaciones` (IDOR corregido 2026-07-12)

Firma vigente tras la migración `20260712000000_fix_search_licitaciones_idor.sql`:

```sql
search_licitaciones(search_query text)
  returns table (id, hash, file_name, data, created_at, updated_at, rank)
  language sql stable
  security invoker
  set search_path = public, pg_temp
-- where l.user_id = auth.uid() and (FTS websearch_to_tsquery('spanish', ...) or ILIKE fallback)
```

Cambios frente a la definición previa (`20260329000000_fulltext_search.sql`):

- se elimina el parámetro `user_id_param uuid` controlable por el llamante (era el vector del IDOR)
- `SECURITY INVOKER` en vez de `SECURITY DEFINER` → la RLS de `public.licitaciones` se aplica
- filtro explícito `l.user_id = auth.uid()` como defensa en profundidad
- `search_path` fijo; `EXECUTE` sólo para `authenticated`
- se endurece además el `search_path` de las funciones trigger `update_updated_at_column` y `update_extraction_templates_updated_at`

El frontend (`src/services/db.service.ts`) no cambia: ya invocaba `rpc('search_licitaciones', { search_query })`.

---

## 6. Tracing y observabilidad

`SupabaseLogTraceProcessor` (en `_shared/agents/tracing.ts`) se registra una vez al cargar `analyze-with-agents/index.ts` con `setTraceProcessors([...])`. Emite una línea `[trace]` con JSON por cada evento del SDK (`trace_start`, `trace_end`, `span_start`, `span_end`):

```bash
npx supabase functions logs analyze-with-agents --tail | grep '\[trace\]'
```

Cada línea incluye `event`, `traceId`, `spanId`, `parentId`, `name`, `durationMs` y, si aplica, `error`. Filtrando por `traceId` se reconstruye una ejecución completa.

`requestId` (`crypto.randomUUID()`) se genera al inicio del handler de `analyze-with-agents` y viaja en `[analyze]` log lines (`reqId=...`) y en `PipelineContext`. Esto permite correlacionar SSE ↔ logs ↔ spans.

---

## 7. API Reference

La petición añade `X-Idempotency-Key` (8–200 caracteres seguros). El frontend genera una clave por análisis y la reutiliza si un 401 obliga a refrescar la sesión. El primer evento SSE es ahora:

```text
job_created { jobId, status, created }
```

Después continúa el contrato de fases existente:

`job_created` → `heartbeat` → `phase_started/ingestion` → `phase_completed/ingestion` → `phase_started/document_map` → `phase_completed/document_map` → `phase_started/extraction` → `extraction_progress` ×9 → `phase_completed/extraction` → `phase_started/consolidation` → `phase_completed/consolidation` → `phase_started/validation` → `phase_completed/validation` → `complete`.

Si el stream finaliza después de `job_created` pero antes de `complete`, `JobService` consulta `analysis_jobs` por `jobId` hasta `completed`, `failed`, `cancelled` o `dead_letter`. RLS garantiza que solo el propietario puede leerlo.

### 7.1. Persistencia durable de pasos

La migración `20260716101822_analysis_jobs_durable_foundation.sql` crea:

- `analysis_job_steps`: ledger por paso, intentos, lease, siguiente intento, input/output refs y error;
- `analysis_job_outbox`: evento idempotente y message id de PGMQ;
- colas privadas `analysis_steps` y `analysis_steps_dead_letter`;
- RPC backend-only para crear, encolar, reclamar, completar, fallar y registrar fases.

El trigger privado de outbox llama `pgmq.send` antes del commit. Un checkpoint correcto llama `pgmq.archive`; un error con presupuesto restante aplica `pgmq.set_vt` y un error final publica en DLQ. PGMQ no se expone al Data API ni recibe permisos de cliente.

`chat-with-analysis-agent` responde con `{ answer, citations, usedTools, sessionId }`.

---

## 8. Deploy

```bash
# Prerrequisitos:
pnpm typecheck && pnpm test -- --run && pnpm benchmark:pliegos && pnpm test:e2e

# Deploy (desde 2026-05-09 ninguna función usa --no-verify-jwt):
npx supabase functions deploy analyze-with-agents
npx supabase functions deploy chat-with-analysis-agent

# Secrets:
npx supabase secrets set OPENAI_API_KEY=sk-...
```

El workflow `ci-cd.yml` (job `deploy-supabase`) ejecuta exactamente estos comandos tras un merge a `main`. El job `smoke-test` posterior valida que las dos funciones responden 401 a peticiones sin JWT.

### Migraciones — orden de ficheros

El nombre de fichero de cada migración debe ordenar cronológicamente por encima de todas las migraciones de las que dependa (Supabase las aplica en orden lexicográfico de nombre). En 2026-07-12 se corrigió `add_provider_reading_mode`, cuyo timestamp `20250130000000` ordenaba antes que `20251228000000_initial_schema` y rompía el _branching preview_ (apply en frío): se renombró a `20251229000000`, se idempotentizó, y se reparó el historial remoto borrando la fila vieja de `supabase_migrations.schema_migrations` (equivalente a `supabase migration repair --status reverted`). Ver `DEPLOYMENT.md` (§ "Orden de migraciones y Supabase Preview").

---

## 9. Testing

### Edge Function unit tests (Deno)

```bash
deno test supabase/functions/analyze-with-agents/__tests__/agents.test.ts
deno test --allow-env --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/tools_test.ts
```

### Frontend tests (Vitest)

Sin cambios. Mismos comandos y umbrales que antes.

### Functional benchmark

```bash
pnpm benchmark:pliegos
```

Protege paridad semántica del pipeline tras la migración a `@openai/agents`.

### Evaluación IA live

```bash
pnpm eval:pliegos:check
pnpm eval:pliegos:live
```

El primer comando prueba el scorer determinista y forma parte de `verify:release`. El segundo reutiliza las fases productivas A-E, llama realmente a OpenAI y registra solo métricas/versiones/fingerprint/latencias bajo `evals/results/` (ignorado por Git). El dataset y contrato están documentados en `evals/pliegos/README.md`; se requiere `OPENAI_API_KEY` en `.env.local` y el runner elimina Files/Vector Stores en `finally`.

El benchmark responde «¿la proyección de producto sigue interpretando correctamente un resultado canónico?». El eval live responde «¿el pipeline/modelo extrae correctamente y sin alucinar desde el documento?». Ninguno sustituye al otro.

---

## Apéndice — Decisiones clave

> **Hotfix 2026-07-12 (RunContext):** el SDK llama `instructions(runContext, agent)` y `runContext.context` ya es el `PipelineContext`; los agentes hacían un segundo `.context` (undefined) y toda Fase B moría con `Cannot read properties of undefined (reading 'fileNames')`. Corregido en los 3 agentes y blindado con tests que resuelven las instrucciones vía `agent.getSystemPrompt(new RunContext(ctx))`. Detalle en `ARCHITECTURE.md` §8.8.

> **Hotfix 2 2026-07-12 (fileSearchTool):** los vector store ids son el primer argumento posicional de `fileSearchTool`; la llamada estilo-opciones enviaba `vector_store_ids=[{...}]` y OpenAI devolvía 400 invalid_type. Corregido (`fileSearchTool([id])`), forma wire fijada por tests, y `@ts-nocheck` eliminado de los agentes. Detalle en `ARCHITECTURE.md` §8.9.

> **Fix 3 2026-07-12 (diagnóstico veraz + jobs):** el polling de indexación reintenta 429/5xx y distingue «conteos desconocidos» (`pollFailed`) de un timeout real — el aviso «OCR pobre» ya no puede dispararse por un rate limit del endpoint de estado; las escrituras de cierre de `analysis_jobs` se esperan antes de cerrar el stream (antes se perdían y el job quedaba `processing` para siempre); `BLOCK_CONCURRENCY` baja a 2. Detalle en `ARCHITECTURE.md` §8.10.

| Decisión               | Elección                                       | Razón                                                          |
| ---------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| SDK del pipeline       | `@openai/agents@0.3.1`                         | Tracing nativo, guardrails declarativos                        |
| Pin del SDK            | 0.3.1                                          | Última compatible con zod 3.x                                  |
| Pin de zod             | 3.25.76                                        | Mínimo aceptado por el SDK                                     |
| Auth                   | `verify_jwt=true` (gateway) en ambas funciones | Rechazo en gateway, menos código en handlers, postura uniforme |
| Construcción de Agents | Per-request                                    | `fileSearchTool` enlaza vectorStoreIds en construcción         |
| Path único Fase C      | `git revert` para revertir                     | Sin flag inline ni legacy fallback (eliminados 2026-05-09)     |
| Rollback de auth       | `verify_jwt=false` + `--no-verify-jwt`         | Cambio coordinado en config + comando                          |

---

_Documentación actualizada el 2026-07-16 con la Fase 1A durable (job previo, Storage recuperable, ledger/outbox/PGMQ, idempotencia y polling por `jobId`). Ver `CHANGELOG.md`, `SPEC.md` §10.9 y `ARCHITECTURE.md` §8.12._
