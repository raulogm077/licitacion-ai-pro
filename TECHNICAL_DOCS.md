# Documentación Técnica — Analista de Pliegos

> Versión: 2.9.0 | Fecha: 2026-07-16

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

**Analista de Pliegos** es una aplicación SaaS que analiza documentos de licitaciones públicas mediante jobs durables. Las fases B y C se ejecutan vía `@openai/agents@0.3.1`; la capa conversacional `chat-with-analysis-agent` opera sobre análisis persistidos.

Las funciones públicas usan JWT de gateway; el worker interno usa un token M2M en Vault. Detalle en §5.

---

## 2. Arquitectura del Sistema

Ver `ARCHITECTURE.md` para el diagrama completo y los componentes principales.

### Flujo de análisis (Pipeline por Fases)

```
Usuario selecciona documentos
       → Frontend valida + SHA-256 (sin base64)
       → POST analysis-jobs {action:init, metadatos} → job + tokens firmados
       → uploadToSignedUrl → Storage privado
       → POST analysis-jobs {action:submit} → PGMQ + HTTP 202
       → analysis-worker reclama lease y ejecuta un checkpoint
           A+B: Ingesta + mapa
           C: Extracción por bloques (Agents SDK + file_search)
           D: Consolidación determinista
           E: Validación determinista + resultado final
       → Postgres archiva/encola el siguiente paso atómicamente
       → Realtime Broadcast privado despierta lectura RLS; polling es fallback
       → Frontend valida con Zod y persiste en `licitaciones`
```

---

## 3. Stack Tecnológico

| Capa        | Tech                                                                             | Versión                                       |
| ----------- | -------------------------------------------------------------------------------- | --------------------------------------------- |
| Frontend    | React + TypeScript + Vite + Tailwind + Zustand                                   | 18.2 / 5.5 / 7.3 / 3.4 / 5.0                  |
| UI (Iris)   | motion (LazyMotion) + sonner + recharts + canvas-confetti + @fontsource-variable | solo-cliente (bundle Vite; no afectan a Deno) |
| Validación  | Zod                                                                              | 3.25.76 (alineado con `@openai/agents@0.3.1`) |
| Backend     | Supabase Edge Functions + Storage + PGMQ + Realtime + pg_net/pg_cron/Vault       | 2.x                                           |
| AI Pipeline | `@openai/agents`                                                                 | 0.3.1                                         |
| Subyacente  | OpenAI Responses API + Files API + Vector Store                                  | latest                                        |
| DB          | PostgreSQL                                                                       | 15+                                           |
| Hosting     | Vercel + Supabase Cloud                                                          | latest                                        |

---

## 4. Backend — Edge Functions

### `analyze-with-agents`

**Archivo**: `supabase/functions/analyze-with-agents/index.ts`

**Auth model**: `verify_jwt = true` en `supabase/config.toml`. El gateway rechaza requests sin JWT válido con 401 antes de invocar la función. El handler sólo resuelve `user` para rate-limit y ownership. El bloque de auth manual fue eliminado en M3.

**Rol vigente**: rollback SSE compatible. Conserva el pipeline A-E y el schema, pero la UI de Fase 1B usa el control plane asíncrono.

### `analysis-jobs`

**Archivo**: `supabase/functions/analysis-jobs/index.ts`

**Auth**: `verify_jwt = true` + resolución defensiva del usuario. `init` acepta solo metadatos/hash/plantilla, crea el job antes de efectos y firma uploads. `submit` verifica presencia en Storage, encola `ingestion_map` y responde `202`. El control body está limitado a 256KB; no recibe bytes.

### `analysis-worker`

**Archivo**: `supabase/functions/analysis-worker/index.ts`

**Auth**: `verify_jwt = false` exclusivamente por ser M2M; requiere `x-analysis-worker-token`, cuyo texto plano está en Vault y cuyo SHA-256 está en una tabla backend-only.

**Ejecución**: reclama un mensaje con lease de 155 s, calibrado sobre el wall clock Free de 150 s. Ingesta y mapa ocupan slices separadas; extracción procesa como máximo dos bloques concurrentes, persiste cada resultado y hace `yield_analysis_step` si quedan bloques/plantilla. Un yield no consume retry; un crash sí. Al terminar la fase, `advance_analysis_step` archiva y publica el siguiente outbox en una transacción. Cleanup TTL sigue OpenAI → Storage → documento y se activa también de forma horaria.

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

| Archivo                | Función                                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `agents/sdk.ts`        | Re-export nombrado explícito de `@openai/agents@0.3.1`                                                                                       |
| `agents/context.ts`    | `PipelineContext` + `createPipelineContext()`                                                                                                |
| `agents/guardrails.ts` | `jsonShapeGuardrail<T>` + `templateSanitizationGuardrail` + parsers                                                                          |
| `agents/tracing.ts`    | `SupabaseLogTraceProcessor`                                                                                                                  |
| `config.ts`            | Constantes (`OPENAI_MODEL`, `BLOCK_MODEL_OVERRIDES`/`modelForBlock`, `CHAT_MODEL`, timeouts, concurrencia, backoff, límites de payload/rate) |
| `cors.ts`              | Whitelist de orígenes                                                                                                                        |
| `rate-limiter.ts`      | `checkRateLimit` parametrizable con clave namespaced: `analyze:` 10/h, `chat:` 60/h por usuario                                              |
| `utils/concurrency.ts` | `runWithConcurrency` (compartida entre ingestion y block-extraction)                                                                         |
| `utils/retry.ts`       | `retryWithBackoff` con `maxDelayMs` (backoff real 429/5xx en Fase C)                                                                         |
| `schemas/canonical.ts` | Schema canónico con TrackedField (zod 3.25.76); desde `canonical-v1.2.0` cubre importes y ponderaciones                                      |
| `utils/error.utils.ts` | Mapeo de errores OpenAI + `Input/OutputGuardrailTripwireTriggered`                                                                           |
| `utils/timeout.ts`     | `callWithTimeout` con `Promise.race` (90s por `run()`)                                                                                       |

---

## 5. Auth y postura de seguridad

Las tres funciones públicas usan `verify_jwt = true`; el worker usa auth M2M explícita:

```toml
[functions.analyze-with-agents]
verify_jwt = true

[functions.analysis-jobs]
verify_jwt = true

[functions.chat-with-analysis-agent]
verify_jwt = true

[functions.analysis-worker]
verify_jwt = false
```

### Reglas duras

- el gateway de Supabase rechaza con 401 las peticiones sin JWT válido **antes** de invocar la función
- los handlers públicos no sustituyen la validación del gateway; sí resuelven `user` para ownership/rate-limit
- `analysis-worker` debe conservar la validación explícita del token M2M y nunca aceptar un token desde query/body
- el deploy no fuerza flags que contradigan `supabase/config.toml`; la excepción JWT del worker solo es segura junto a su auth M2M
- el smoke valida 401 de gateway en las tres públicas y 401 M2M en el worker sin token

### Smoke test post-deploy

```bash
# Públicas: 401 del gateway
curl -i -X POST "$SUPABASE_URL/functions/v1/analyze-with-agents" \
  -H 'Content-Type: application/json' \
  -d '{"pdfBase64":""}'

curl -i -X POST "$SUPABASE_URL/functions/v1/chat-with-analysis-agent" \
  -H 'Content-Type: application/json' \
  -d '{"analysisHash":"x","message":"x"}'

curl -i -X POST "$SUPABASE_URL/functions/v1/analysis-jobs" \
  -H 'Content-Type: application/json' \
  -d '{"action":"init"}'

# Worker: 401 de su autenticación M2M
curl -i -X POST "$SUPABASE_URL/functions/v1/analysis-worker" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### Rollback de auth

Si una función pública rechaza JWT legítimos, revertir el cambio responsable y diagnosticar gateway/config; no abrirla como workaround. Si falla el worker, verificar el secreto de Vault y el digest backend-only, conservando siempre el header M2M.

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

`SupabaseLogTraceProcessor` (en `_shared/agents/tracing.ts`) se registra al cargar tanto el rollback `analyze-with-agents` como `analysis-worker`. Emite una línea `[trace]` con JSON por cada evento del SDK (`trace_start`, `trace_end`, `span_start`, `span_end`):

```bash
npx supabase functions logs analyze-with-agents --tail | grep '\[trace\]'
```

Cada línea incluye `event`, `traceId`, `spanId`, `parentId`, `name`, `durationMs` y, si aplica, `error`. Filtrando por `traceId` se reconstruye una ejecución completa.

El rollback usa `requestId`; el consumidor usa `worker:<uuid>` y siempre registra `jobId`, step e intento. Ambos valores viajan en `PipelineContext` para correlacionar estado, logs y spans.

---

## 7. API Reference

El control plane exige `X-Idempotency-Key` (8–200 caracteres seguros). El frontend genera una clave por análisis y la reutiliza si un 401 obliga a refrescar la sesión.

### 7.1. API durable

`POST /analysis-jobs` con `action:init` recibe `files[{name,sizeBytes,mimeType,sha256}]` y `template?`; devuelve `jobId`, estado y `uploads[{path,token,...}]`. Después de `uploadToSignedUrl`, `action:submit` recibe `jobId` y devuelve `202 {status:"queued"}`. El resultado se lee de `analysis_jobs.result` por RLS tras una señal Broadcast o polling.

El primer evento del rollback SSE sigue siendo:

```text
job_created { jobId, status, created }
```

Después continúa el contrato de fases existente:

`job_created` → `heartbeat` → `phase_started/ingestion` → `phase_completed/ingestion` → `phase_started/document_map` → `phase_completed/document_map` → `phase_started/extraction` → `extraction_progress` ×9 → `phase_completed/extraction` → `phase_started/consolidation` → `phase_completed/consolidation` → `phase_started/validation` → `phase_completed/validation` → `complete`.

Si el stream finaliza después de `job_created` pero antes de `complete`, `JobService` consulta `analysis_jobs` por `jobId` hasta `completed`, `failed`, `cancelled` o `dead_letter`. RLS garantiza que solo el propietario puede leerlo.

### 7.2. Persistencia durable de pasos

La migración `20260716101822_analysis_jobs_durable_foundation.sql` crea:

- `analysis_job_steps`: ledger por paso, intentos, lease, siguiente intento, input/output refs y error;
- `analysis_job_outbox`: evento idempotente y message id de PGMQ;
- colas privadas `analysis_steps` y `analysis_steps_dead_letter`;
- RPC backend-only para crear, encolar, reclamar, completar, fallar y registrar fases.

El trigger privado de outbox llama `pgmq.send` antes del commit. Un checkpoint correcto llama `pgmq.archive`; un error con presupuesto restante aplica `pgmq.set_vt` y un error final publica en DLQ. PGMQ no se expone al Data API ni recibe permisos de cliente.

La migración `20260716114116_analysis_worker_async_runtime.sql` añade claim global y avance atómico, activación post-commit con `pg_net`, recovery condicionado con `pg_cron`, Vault para el token M2M y autorización de Broadcast por `realtime.topic()` + ownership del job.

### 7.3. Recuperación de pasos abandonados

`claim_analysis_step` solo admite pasos en `queued`/`retrying` y `fail_analysis_step` exige que el llamante siga siendo dueño del lease. Un paso abandonado en `running` —porque la plataforma mató el isolate— no encajaba en ninguno de los dos, así que un lease expirado era terminal por omisión.

Con Fase 1B esa laguna se reparte entre dos mecanismos que no se solapan, y el reparto importa:

| Estado abandonado                                                | Quién lo recupera                                                          | Cómo                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| Paso `running`, lease vencido, job `async_worker`                | `claim_next_analysis_step` + `private.recover_analysis_worker` (`pg_cron`) | Reanuda **desde el checkpoint**, sin perder bloques |
| Paso `running`, lease vencido, job `inline_transition`           | `reclaim_stale_analysis_steps`                                             | `dead_letter` + DLQ (`reason='lease_expired'`)      |
| Job no terminal sin ningún paso en `running`/`queued`/`retrying` | `reclaim_stale_analysis_steps`                                             | job a `dead_letter` tras `p_orphan_after_seconds`   |

`reclaim_stale_analysis_steps(p_limit, p_orphan_after_seconds)` (migraciones `20260727130000` y `20260727150000`) es el único sitio autorizado a sacar un paso de `running` sin poseer su lease, y solo cuando el lease ya ha caducado. **No toca los jobs `async_worker` a propósito**: su consumidor los reanuda desde el checkpoint, que es estrictamente mejor que reencolar, y dos escritores sobre el mismo estado podrían marcar `retrying` —con un `error` visible en la fila— sobre un análisis que se está recuperando solo. Se queda con lo que nadie más puede retomar: la ruta inline, donde el ejecutor es la propia petición, y los jobs huérfanos, invisibles para `recover_analysis_worker` porque no tienen nada en cola.

Un lease todavía vigente nunca se toca, así que el barrido no puede matar trabajo en vuelo; y es idempotente (una segunda pasada recupera 0 filas). Es `SECURITY INVOKER` y ejecutable solo por `service_role`, igual que el resto de RPC durables. Lo dispara `analyze-with-agents` de forma oportunista al inicio de cada request.

### 7.4. Progreso visible durante la ejecución asíncrona

El navegador tiene dos fuentes de progreso y **ambas deben emitir**: el Broadcast privado `analysis-job:<jobId>`, que es best-effort, y el polling RLS de `analysis_jobs`, que es su fallback. Durante Fase 1B el polling solo leía la fila para detectar estados terminales, así que una ejecución sin frames de Broadcast dejaba la UI congelada en el mensaje del envío pese a que el worker avanzaba (ver `SPEC.md` §10.12).

Ambas fuentes emiten por el mismo punto (`emitDurableProgress`), para que cuenten lo mismo. La clave de deduplicación es `status:phase` más el contador de bloques, nunca `updated_at`: el worker hace varios checkpoints dentro de una fase y repetir la línea en cada uno sería ruido, pero uno que sí avanza un bloque tiene que reportarse.

Durante la extracción se emite `extraction_progress` en vez de `phase_progress`, que es el evento que `ai.service` sabe proyectar dentro del rango de la fase (20-80). El dato sale de la columna `analysis_jobs.progress`, un `{"done","total"}` compacto que el worker escribe en el mismo checkpoint que ya hacía. Se separó a propósito de `phase_results`: ese JSON lleva los datos y las evidencias de cada bloque —cientos de KB— y el navegador lo sondea cada 2 s, así que leerlo entero solo para pintar «4 de 9» sería desproporcionado. El trigger de Broadcast incluye `progress` en su lista de columnas vigiladas; sin eso, un checkpoint de bloque no despertaría a nadie.

`blockIndex` significa **bloques terminados** (de 0 a `totalBlocks`), no el índice del bloque en curso: el cociente tiene que ser la fracción completada de la fase. `record_analysis_phase` conserva el contador mientras no cambie la fase —el worker hace checkpoints que no siempre lo aportan— y lo limpia en la transición; `completeJob` y `failJob` lo anulan. El lector del navegador acota a `[0, total]` antes de proyectarlo a porcentaje.

### 7.5. Presupuesto de ejecución atado al techo de plataforma

`PIPELINE_TIMEOUT_MS` ya no es una constante suelta: se deriva de `EDGE_WALL_CLOCK_MS` (150 s por defecto, el techo del plan free) menos `PIPELINE_SHUTDOWN_MARGIN_MS` (10 s). Si el pipeline sobrevive al techo de la plataforma, el isolate muere sin ejecutar `catch`, `finally` ni el `setTimeout` del pipeline, y el paso queda en `running` para siempre. Derivarlo garantiza que el guard de código dispare primero y el fallo llegue a persistirse.

Al subir el timeout en Dashboard → Project Settings → Edge Functions (plan Pro, hasta 400 s), hay que fijar el secret `EDGE_WALL_CLOCK_MS` al mismo valor; si no, el pipeline seguirá presupuestando 140 s. Valores fuera de `[60000, 400000]` o no numéricos caen al defecto.

### 7.6. Modelo por bloque de extracción

`buildBlockAgent` resuelve su modelo con `modelForBlock(blockName)`, que devuelve `OPENAI_MODEL` salvo que exista una entrada en `BLOCK_MODEL_OVERRIDES` (`_shared/config.ts`). **El mapa está vacío en `main`**: el mecanismo está montado y probado, pero rellenarlo es una promoción de modelo y el contrato de release la condiciona a registrar antes una baseline manual de `pnpm eval:pliegos:live`.

Ese gate no es burocracia. `pnpm benchmark:pliegos` valida fixtures ya generados y **no llama al modelo**, así que seguiría en verde aunque un modelo más barato extrajera mucho peor; el benchmark no puede detectar esta clase de regresión y la evaluación live sí. El modelo elegido debe además soportar Responses API con `file_search`: sin eso el bloque se queda sin recuperación documental y responde de memoria, que es la peor forma de fallar porque parece funcionar.

Trazabilidad: el span de generación del SDK ya incluye `model` en `SPAN_DATA_SAFE_KEYS`, así que cada línea `[trace]` dice con qué modelo corrió cada bloque junto a su `agent_name` (`blockExtractor:<bloque>`). En cuanto haya un override, `ANALYSIS_RUNTIME_VERSIONS` añade `blockModels` y el `runtime_version` persistido en el job deja constancia de qué modelo extrajo qué; mientras el mapa esté vacío la clave no aparece y la forma persistida no cambia.

`chat-with-analysis-agent` responde con `{ answer, citations, usedTools, sessionId }`.

---

## 8. Deploy

```bash
# Prerrequisitos:
pnpm typecheck && pnpm test -- --run && pnpm benchmark:pliegos && pnpm test:e2e

# Deploy backend antes del frontend:
npx supabase db push --include-all
npx supabase functions deploy analyze-with-agents
npx supabase functions deploy analysis-jobs
npx supabase functions deploy analysis-worker
npx supabase functions deploy chat-with-analysis-agent

# Secrets:
npx supabase secrets set OPENAI_API_KEY=sk-...
```

El workflow aplica migraciones y funciones antes de Vercel. El smoke posterior valida CORS, gateway JWT y auth M2M.

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

| Decisión               | Elección                                         | Razón                                                      |
| ---------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| SDK del pipeline       | `@openai/agents@0.3.1`                           | Tracing nativo, guardrails declarativos                    |
| Pin del SDK            | 0.3.1                                            | Última compatible con zod 3.x                              |
| Pin de zod             | 3.25.76                                          | Mínimo aceptado por el SDK                                 |
| Auth pública           | `verify_jwt=true` en las tres funciones públicas | Rechazo en gateway y ownership dentro del handler          |
| Auth del worker        | Token M2M aleatorio en Vault + digest SHA-256    | `pg_net` puede invocarlo sin exponer `service_role`        |
| Construcción de Agents | Per-request                                      | `fileSearchTool` enlaza vectorStoreIds en construcción     |
| Path único Fase C      | `git revert` para revertir                       | Sin flag inline ni legacy fallback (eliminados 2026-05-09) |
| Rollback de auth       | `verify_jwt=false` + `--no-verify-jwt`           | Cambio coordinado en config + comando                      |

---

_Documentación actualizada el 2026-07-16 con Fase 1B (upload firmado, worker independiente, checkpoints atómicos, Realtime/polling, Vault y cleanup TTL). Ver `CHANGELOG.md`, `SPEC.md` §10.10 y `ARCHITECTURE.md` §8.13._

### 7.7. Grounding de importes y ponderaciones

`TrackedField` cubría seis campos de `datosGenerales`. Desde `canonical-v1.2.0` cubre también los números que alimentan decisiones, no sólo la pantalla:

| Campo                                     | Por qué lleva grounding                                              |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `economico.presupuestoBaseLicitacion`     | Base de la fórmula de precio y del umbral de baja temeraria          |
| `economico.valorEstimadoContrato`         | Base del VAM contra el que se compara la solvencia económica         |
| `economico.importeIVA`                    | Se cruza con PBL y VEC para detectar importes mezclados              |
| `criteriosAdjudicacion.*.ponderacion`     | Decide dónde merece la pena invertir esfuerzo en la oferta           |
| `criteriosAdjudicacion.umbralAnormalidad` | Es el texto del que `parseAnomalyThreshold` deduce la baja temeraria |

Quedan planos a propósito `tipoIVA` (es un tipo impositivo, no un importe), `desglosePorLotes[].presupuesto` (ya tiene `cita` por lote) y `subcriterios[].ponderacion` (hoy no lo renderiza nadie, así que envolverlo sería churn sin grounding visible).

**Compatibilidad hacia atrás sin migrar datos.** El `preprocess` de `TrackedField` acepta el valor plano de los análisis ya guardados y lo envuelve con `status: 'extraido'` — pero **sin fabricarle evidencia**, que es lo que distingue un dato acreditado de uno heredado. `unwrap()` cubre la dirección contraria en el frontend. No hay migración de filas ni backfill.

**Dos sitios que el compilador no habría cazado.** `consolidation.ts` y `validation.ts` corren sobre `CanonicalResult` con `@ts-nocheck` aguas arriba:

- La suma de ponderaciones (`sum + criterio.ponderacion`) habría concatenado objetos y producido una advertencia con una cadena en vez de un total. Se resuelve con el helper local `trackedNumber`.
- `evaluateObjectQuality` contaba claves no vacías; un `TrackedField` vacío es un objeto y habría contado como dato presente, de modo que un bloque económico sin un solo importe se habría reportado como `COMPLETO`. Ahora mira dentro del envoltorio antes de decidir.

Al rellenarse desde el bloque económico, `datosGenerales.presupuesto` hereda además la evidencia del importe de origen: la cita que respalda el número es la de donde salió, no la del bloque que no lo encontró.

### 7.8. Contradicción entre mapa y extracción

`jsonShapeGuardrail` valida la **forma** de la salida de cada bloque, no su sustancia. Un `file_search` que no recupera nada produce un JSON vacío y perfectamente conforme al schema, así que atraviesa el guardrail, la extracción, la consolidación y la validación sin que ninguna red lo vea (`SPEC.md` §11.4).

El contraste lo aporta el mapa documental de la Fase B, que ya marcaba por documento `contieneCriterios`, `contienePresupuesto`, `contieneSolvencia`, `contienePlazos`, `contieneRequisitos`, `contieneRestricciones` y `contieneModeloServicio`.

| Pieza                   | Dónde                                   | Qué hace                                                                                                         |
| ----------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `BLOCK_EXPECTATIONS`    | `_shared/schemas/block-expectations.ts` | Bloque → bandera del mapa. Siete de nueve bloques; añadir una entrada es lo único necesario para incorporar otro |
| `isBlockEmpty`          | ídem                                    | Predicado explícito por bloque. **Nunca** afirma vacío sobre un bloque sin predicado                             |
| `documentsPromising`    | ídem                                    | Documentos que el mapa señaló, para dirigir la re-consulta                                                       |
| `withTargetedRetrieval` | `analyze-with-agents/prompts/index.ts`  | Sufijo que nombra el fichero y **autoriza el vacío**                                                             |
| `emptyDespiteMapBlocks` | `BlockExtractionDiagnostics`            | Viaja en el checkpoint hasta la Fase E                                                                           |

**El módulo no lleva `@ts-nocheck`** — es el único del pipeline sin él. Es lógica pura sin SDK y de ella depende decidir si un bloque se reintenta, así que se type-checkea de verdad y se cubre con tests deterministas: el único gate semántico del repo (`pnpm eval:pliegos:live`) es manual, de modo que lo que pueda verificarse sin clave debe verificarse sin clave.

**Coste.** Cero llamadas nuevas en el camino feliz. La re-consulta ocurre dentro de la tarea del bloque, así que no altera el modelo de slices ni el lease de 155 s; el peor caso realista es un bloque extra, ~15-25 s.

**Diagnóstico resultante:**

| Mapa        | Extracción             | Código                                       | Consejo al usuario            |
| ----------- | ---------------------- | -------------------------------------------- | ----------------------------- |
| no lo sitúa | vacía                  | `missing_in_uploaded_docs`                   | completar la documentación    |
| lo sitúa    | vacía tras re-consulta | `retrieval_failed` + `extraction_incomplete` | **reintentar; no subir nada** |
| lo sitúa    | con contenido          | `present`                                    | —                             |

`extraction_incomplete` se evalúa **antes** que `missing_administrative_content` en la guía del dashboard, y las secciones marcadas quedan excluidas del recuento de huecos documentales: sin eso el usuario recibía las dos mentiras a la vez, el capítulo diciendo que su PCAP no trae los criterios y la guía global pidiéndole el PCAP que ya había subido.

### 7.9. Invariante del predicado de vacío

`isBlockEmpty` (Fase C) y `evaluateArraysQuality`/`evaluateObjectQuality` (Fase E) juzgan lo mismo desde sitios distintos. Para que la re-consulta dirigida de §7.8 se dispare cuando debe:

> **Cada predicado de `HAS_SIGNAL` debe ser al menos tan estricto como la noción de vacío que la Fase E aplica a esa sección.**

| Sección                 | Fase E cuenta                       | `HAS_SIGNAL` cuenta          | Relación       |
| ----------------------- | ----------------------------------- | ---------------------------- | -------------- |
| `criteriosAdjudicacion` | `subjetivos`, `objetivos`           | `subjetivos`, `objetivos`    | igual ✔        |
| `economico`             | todas las claves, incluida `moneda` | solo PBL / VEC / IVA / lotes | más estricto ✔ |
| `duracionYProrrogas`    | todas las claves                    | solo duraciones y fechas     | más estricto ✔ |
| resto                   | arrays de la sección                | los mismos arrays            | igual ✔        |

Ser más estricto es seguro: como mucho cuesta una re-consulta sobre una sección pobre. Ser más laxo **apaga el mecanismo sin que nada falle** — ocurrió con `umbralAnormalidad` en el job `8e851069`.

Por el mismo motivo, el diagnóstico `retrieval_failed` no exige `status === 'VACIO'`: se aplica si el bloque está en `emptyDespiteMapBlocks` y la sección está `VACIO` **o** no aporta evidencias. La Fase C tiene certeza; la Fase E, una heurística.

### 7.10. `countsUnreliable`: cuándo los contadores de ingesta no dicen nada

`IngestionDiagnostics.countsUnreliable` (antes `pollFailed`) marca que los contadores **no son una medición** y por tanto no permiten juzgar el documento. `derivePartialReasons` lo comprueba antes de emitir `ocr_or_indexing_low_signal`.

Se activa en dos situaciones, deliberadamente bajo la misma bandera:

| Causa                                                | Qué ocurrió                    | `zeroCompletedFiles` |
| ---------------------------------------------------- | ------------------------------ | -------------------- |
| El sondeo de estado falló (429, red)                 | nunca se leyó `file_counts`    | `false`              |
| El sondeo respondió con todo a cero pasada la gracia | el lote no llegó a registrarse | `false`              |

En ambas, `zeroCompletedFiles` se deja en `false` a propósito: solo puede afirmarse sobre un recuento real.

El bucle de espera cierra únicamente cuando `in_progress === 0` **y** `completed + failed + in_progress > 0`. Con los tres a cero sigue esperando hasta `VECTOR_STORE_REGISTRATION_GRACE_MS` (10 s), porque en ese estado `in_progress === 0` significa «aún no ha empezado», no «terminó». La ventana es parametrizable en la firma —igual que `pollRetryOptions`— para que el test del caso no duerma 13 s de reloj real.

### 7.11. Estado de verificación de una cita

`TrackedEvidenceWire.verification` (`src/shared/analysis-contract.ts`, espejado en `_shared/schemas/canonical.ts` y en `src/lib/schemas.ts`) responde a una única pregunta: **¿alguien ha buscado esta cita en el documento?** No a si el dato es correcto.

| Estado         | Significa                                              | Quién lo escribe          |
| -------------- | ------------------------------------------------------ | ------------------------- |
| `unverified`   | nadie la ha contrastado                                | defecto — **el único hoy** |
| `verified`     | aparece literalmente en el texto del documento         | Fase 3 de `ADR-003`       |
| `not_found`    | se buscó y no aparece ⇒ la cita es fabricada           | Fase 3 de `ADR-003`       |
| `unverifiable` | no hay texto contra el que contrastar (escaneo sin OCR) | Fase 3 de `ADR-003`       |

Es opcional en el wire a propósito: todo el histórico lo trae ausente. Por eso **nunca se lee `evidence.verification` directamente** —eso obligaría a repetir el defecto en cada consumidor— sino a través de `evidenceVerification(evidence)`, que centraliza el `?? 'unverified'` en un sitio.

`not_found` y `unverifiable` se separan deliberadamente. El primero afirma algo sobre la cita; el segundo admite que no lo sabemos. Colapsarlos repetiría en el terreno de la evidencia el error de §7.10 con los contadores: presentar la ausencia de medición como si fuera una medición.

Hoy el pipeline no emite ningún estado distinto de `unverified` porque **falta la primitiva**: el texto del documento en nuestro lado. `EvidenceToggle` refleja los cuatro casos ya (título del botón, icono y nota), de modo que la Fase 3 solo tenga que empezar a escribir el campo.

### 7.12. Oráculo de verificación: el texto local del documento

`supabase/functions/_shared/document-text.ts` (ADR-003 Fase 2). Extrae el texto de un documento y lo devuelve con un estado. **Nunca lanza**: cualquier fallo vuelve como estado, porque perder el oráculo no puede tumbar el análisis del usuario.

```ts
extractDocumentText(bytes, fileName, mimeType?, { maxChars?, timeoutMs? })
  → { status, text, charCount, pageCount, reason? }
```

| Estado        | Cuándo                                          | `absenceIsConclusive` |
| ------------- | ----------------------------------------------- | --------------------- |
| `extracted`   | texto completo                                  | **true**              |
| `truncated`   | superó `DOCUMENT_TEXT_MAX_CHARS` (1.000.000)    | false                 |
| `empty`       | parseó bien y el texto está vacío tras `trim()` | false                 |
| `unsupported` | sin extractor para ese formato (p. ej. `.docx`) | false                 |
| `failed`      | el parser falló o agotó `DOCUMENT_TEXT_TIMEOUT_MS` | false              |

`absenceIsConclusive(status)` es la **única** función autorizada a responder si una cita ausente puede declararse fabricada. La Fase 3 traduce `true → not_found` y `false → unverifiable`. Encontrar la cita es concluyente en todos los estados; lo que exige texto completo es afirmar que no está.

**PDF: `unpdf`.** Es pdf.js empaquetado para entornos serverless: cero dependencias en tiempo de ejecución y ningún módulo nativo en el camino de texto. `@napi-rs/canvas` figura como peer opcional y solo se resuelve al **renderizar** páginas, algo que este módulo no hace — importante, porque un módulo nativo no cargaría en el runtime de las Edge Functions.

**La copia del buffer no es defensiva de más.** `getDocumentProxy` recibe `new Uint8Array(bytes)` porque pdf.js toma posesión del buffer y puede dejarlo separado. El worker sube **esos mismos bytes** a OpenAI justo después: sin la copia subiría un fichero vacío sin que nada fallara. Hay un test que lo fija.

**Dónde se invoca.** `persistDocumentText`, en `analysis-worker`, dentro de `downloadAndVerifyDocuments` y después de la comprobación SHA-256. El `upsert` va sobre `document_id`, así que un reintento de la slice reescribe en vez de duplicar. Un error de guardado se registra y se continúa: la ausencia de fila y un estado de fallo significan lo mismo para la Fase 3.

**Coste medido.** 250 páginas densas → 1,3 MB de texto en ~1,2 s. Frente al presupuesto de slice (150 s) no compite con nada; el tope de 20 s existe solo para que un PDF degenerado no se lo coma.

### 7.13. Superficie efectiva de schemas tras la auditoría

La auditoría de 2026-08-07 confirmó que `_shared/schemas/index.ts`, `job.ts` y `validation.ts` no tenían consumidores de runtime, tests, scripts ni workflows. El barrel solo enlazaba los dos schemas huérfanos con módulos que ya se importaban directamente; mantenerlo producía una segunda representación del job y del informe de validación sin validación efectiva.

La superficie vigente se importa por fichero: `canonical.ts`, `blocks.ts`, `document-map.ts` y `block-expectations.ts`. El estado durable se valida en los límites de servicio/RPC y la calidad final la calcula `analyze-with-agents/phases/validation.ts`; no debe recrearse un barrel genérico salvo que exista un consumidor real y comprobado.
