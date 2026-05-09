# Documentación Técnica — Analista de Pliegos

> Versión: 2.5.0 | Fecha: 2026-05-09

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

| Capa | Tech | Versión |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind + Zustand | 18.2 / 5.5 / 7.3 / 3.4 / 5.0 |
| Validación | Zod | 3.25.76 (alineado con `@openai/agents@0.3.1`) |
| Backend | Supabase Edge Functions (Deno) | 2.x |
| AI Pipeline | `@openai/agents` | 0.3.1 |
| Subyacente | OpenAI Responses API + Files API + Vector Store | latest |
| DB | PostgreSQL | 15+ |
| Hosting | Vercel + Supabase Cloud | latest |

---

## 4. Backend — Edge Functions

### `analyze-with-agents`

**Archivo**: `supabase/functions/analyze-with-agents/index.ts`

**Auth model**: `verify_jwt = true` en `supabase/config.toml`. El gateway rechaza requests sin JWT válido con 401 antes de invocar la función. El handler sólo resuelve `user` para rate-limit y ownership. El bloque de auth manual fue eliminado en M3.

**Pipeline**: 5 fases. B y C vía `Agent` + `run()`; D y E sin LLM. Detalle en `ARCHITECTURE.md`.

### `chat-with-analysis-agent`

**Archivo**: `supabase/functions/chat-with-analysis-agent/index.ts`

**Auth model**: `verify_jwt = true` en `supabase/config.toml` (desde 2026-05-09, mismo patrón que `analyze-with-agents`). El handler retira el bloque "if (!token) → 401"; se queda con `supabase.auth.getUser(token)` para resolver el `user` que se necesita para ownership contra `licitaciones` / `analysis_chat_sessions`, y conserva un `if (!user) → 401` defensivo.

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

| Archivo | Función |
|---|---|
| `agents/sdk.ts` | Re-export nombrado explícito de `@openai/agents@0.3.1` |
| `agents/context.ts` | `PipelineContext` + `createPipelineContext()` |
| `agents/guardrails.ts` | `jsonShapeGuardrail<T>` + `templateSanitizationGuardrail` + parsers |
| `agents/tracing.ts` | `SupabaseLogTraceProcessor` |
| `config.ts` | Constantes (modelo, timeouts, concurrencia) |
| `cors.ts` | Whitelist de orígenes |
| `rate-limiter.ts` | 10 req/hora por usuario |
| `schemas/canonical.ts` | Schema canónico con TrackedField (zod 3.25.76) |
| `utils/error.utils.ts` | Mapeo de errores OpenAI + `Input/OutputGuardrailTripwireTriggered` |
| `utils/timeout.ts` | `callWithTimeout` con `Promise.race` (90s por `run()`) |

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

Contrato HTTP y SSE sin cambios respecto a la implementación previa:

`heartbeat` → `phase_started/ingestion` → `phase_completed/ingestion` → `phase_started/document_map` → `phase_completed/document_map` → `phase_started/extraction` → `extraction_progress` ×9 → `phase_completed/extraction` → `phase_started/consolidation` → `phase_completed/consolidation` → `phase_started/validation` → `phase_completed/validation` → `complete`.

`chat-with-analysis-agent` responde con `{ answer, citations, usedTools, sessionId }`.

---

## 8. Deploy

```bash
# Prerrequisitos:
pnpm typecheck && pnpm test -- --run && pnpm benchmark:pliegos && pnpm test:e2e

# Deploy (NOTA: ninguna función usa --no-verify-jwt desde 2026-05-09):
npx supabase functions deploy analyze-with-agents
npx supabase functions deploy chat-with-analysis-agent

# Secrets:
npx supabase secrets set OPENAI_API_KEY=sk-...
# (opcional) rollback de Fase C al camino legacy:
npx supabase secrets set USE_AGENTS_SDK=false
```

El workflow `ci-cd.yml` (job `deploy-supabase`) ejecuta exactamente estos comandos tras un merge a `main`. El job `smoke-test` posterior valida que las dos funciones responden 401 a peticiones sin JWT.

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

---

## Apéndice — Decisiones clave

| Decisión | Elección | Razón |
|---|---|---|
| SDK del pipeline | `@openai/agents@0.3.1` | Tracing nativo, guardrails declarativos |
| Pin del SDK | 0.3.1 | Última compatible con zod 3.x |
| Pin de zod | 3.25.76 | Mínimo aceptado por el SDK |
| Auth | `verify_jwt=true` (gateway) en ambas funciones | Rechazo en gateway, menos código en handlers, postura uniforme |
| Construcción de Agents | Per-request | `fileSearchTool` enlaza vectorStoreIds en construcción |
| Rollback de Fase C | Feature flag `USE_AGENTS_SDK=false` | Sin redeploy |
| Rollback de auth | `verify_jwt=false` + `--no-verify-jwt` | Cambio coordinado en config + comando |

---

*Documentación actualizada el 2026-05-09 tras la migración de auth a gateway en ambas Edge Functions.*
