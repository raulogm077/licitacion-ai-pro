# CLAUDE.md — Project Conventions for Claude Code

## Project Overview

Analista de Pliegos: SaaS app for analyzing Spanish public procurement documents (pliegos de licitacion) using AI. Extracts structured data from PDFs via a 5-phase pipeline.

## Quick Commands

Los que no se adivinan por el nombre. El resto (`dev`, `build`, `typecheck`,
`lint`, `format`, `test:e2e`) son la invocación estándar y están en los scripts
de `package.json`.

```bash
pnpm test -- --run     # Suite unitaria completa, una sola pasada
pnpm benchmark:pliegos # Benchmark funcional del caso principal de producto
pnpm verify:integrity  # Drift de migraciones + workflows + docs/instructions
pnpm verify:release    # Cierre obligatorio de sesión antes de push/PR
```

<!-- release-contract:start -->

- No direct work or deploy from `main`.
- Production deploys only after a green PR is merged into `main`.
- Every session that changes code, runtime, workflows, hooks, or deploy surfaces must end with `pnpm verify:release`.
- If a change touches workflows, hooks, release process, migrations, SSE, `JobService`, `analyze-with-agents`, or other user-visible behavior, the matching docs and instruction files must be updated in the same branch.
- Release-facing changes in the analysis runtime or contract must also keep `pnpm benchmark:pliegos` green before push/PR.
- AI runtime changes must keep `pnpm eval:pliegos:check` green and record a manual `pnpm eval:pliegos:live` baseline before model, prompt, retrieval, or orchestration promotion. The baseline is compared with `pnpm eval:pliegos:diff`, which refuses to compare runs from different datasets and exits non-zero on any per-case regression.

<!-- release-contract:end -->

## Skills de ingeniería instaladas

- Las skills de `addyosmani/agent-skills` están versionadas en
  `.agents/skills/` y registradas en `skills-lock.json`. **Son la forma de
  trabajo por defecto, no una opción**: toda tarea empieza invocando
  `using-agent-skills` para enrutar a las skills de la fase actual (spec, plan,
  implementación, test, review, ship) y se siguen sus pasos, incluida la
  verificación. No cargar el catálogo completo en contexto: solo lo aplicable.
  Si una tarea es tan pequeña que ninguna skill aplica, decirlo explícitamente
  en la respuesta en vez de saltarse el enrutado en silencio.
- Son una capa de proceso aditiva. Si una skill contradice este repositorio,
  prevalecen `AGENTS.md`, `CLAUDE.md`, el contrato de release y los comandos de
  `package.json`: pnpm, rama efímera, PR obligatorio y `pnpm verify:release`.
- Reutilizar los artefactos vivos del proyecto: `SPEC.md` para especificación,
  `BACKLOG.md` para tareas y `plans/` para planes detallados. No crear `tasks/`
  ni documentación paralela solo porque aparezcan en ejemplos genéricos.
- La instalación incluye workflows `SKILL.md` para Codex y enlaces de proyecto
  para Claude Code. No activa hooks, slash commands, personas ni automatismos
  del repositorio de origen.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand. Sistema de diseño «Iris» (marca índigo→violeta, fuentes Inter/Space Grotesk self-hosted). UI libs solo-cliente: `motion` (con `LazyMotion`/`MotionProvider`), `sonner` (toasts vía helper `notify()`), `recharts` (lazy), `canvas-confetti`, `tailwindcss-animate`. Dark mode por clase (`darkMode: 'class'`); toda animación respeta `prefers-reduced-motion`. Estas dependencias no afectan al runtime Deno de las Edge Functions.
- **Backend**: Supabase Edge Functions (Deno runtime) con control plane `analysis-jobs`, consumidor `analysis-worker` y `@openai/agents@0.3.1` sobre OpenAI Responses API
- **DB**: PostgreSQL (Supabase) con RLS, FTS, JSONB, PGMQ, outbox, `pg_net`, `pg_cron` y Vault
- **Hosting**: Vercel (frontend), Supabase Cloud (backend)
- **CI/CD**: GitHub Actions (7-job pipeline)

### Key Patterns

- **TrackedField**: Critical fields use `{ value, status, evidence?, warnings? }` wrapper
- **Shared wire contract**: `src/shared/analysis-contract.ts` es la fuente FE/BE para eventos de progreso, `TrackedFieldWire` y `partial_reasons`; SSE se conserva solo como rollback de Fase 1B
- **`unwrap()`**: Extracts raw value from TrackedField or passes through legacy values
- **Upload + recovery**: el navegador calcula SHA-256, recibe tokens firmados y sube bytes directamente a Storage; Broadcast privado despierta al cliente, que relee `analysis_jobs` por RLS con polling como fallback
- **Durable jobs**: idempotencia por usuario + fingerprint, `analysis_job_steps`, outbox transaccional, PGMQ privado, leases, retry/DLQ y checkpoints reutilizables antes del ack
- **Pipeline phases**: A:Ingestion -> B:DocumentMap -> C:BlockExtraction (2 bloques por slice) -> D:Consolidation -> E:Validation
- **`@openai/agents` (Fases B y C)**: cada fase con LLM construye `Agent<PipelineContext>` por request, con `fileSearchTool` y `jsonShapeGuardrail`. Detalles y reglas en [`AGENTS.md`](./AGENTS.md). El antiguo fallback Responses-API directo (`block-extraction.legacy.ts`) y el flag `USE_AGENTS_SDK` se eliminaron tras confirmar paridad en producción; revertir la migración requiere `git revert` del PR responsable.
- **Tracing**: `SupabaseLogTraceProcessor` emite `[trace]` JSON por evento del SDK. `grep '\[trace\]'` reconstruye la ejecución completa.
- **Auth**: `verify_jwt = true` para las tres funciones públicas (`analysis-jobs`, `analyze-with-agents`, `chat-with-analysis-agent`). `analysis-worker` es la única excepción: `verify_jwt = false` con token M2M aleatorio en Vault y comparación SHA-256. Nunca exponer ese token ni usar `service_role` en el navegador.
- **Primary product path**: The supported release path is one complete expediente PDF; partial docs are accepted but must surface structured `partial_reasons`

### Arquitectura de ejecución asíncrona

Fase 1B separa el request del usuario de la ejecución A–E. `analysis-jobs:init`
crea el job y el plan de subida; `submit` verifica Storage y encola. Cada llamada
a `analysis-worker` reclama un mensaje, guarda un checkpoint completo y luego
hace ack+dispatch de forma atómica.

El proyecto Supabase está en plan Free, con wall clock de 150 s. Por eso el
worker usa lease de 155 s y unidades acotadas: ingesta e indexación se
checkpointan antes del mapa y extracción procesa como máximo dos bloques por
slice. Un `yield` exitoso no consume el presupuesto de tres fallos; un crash sí.
`pg_net` activa tras commit y `pg_cron` recupera en menos de 10 s.

Files y Vector Store se registran en una sola transacción inmediatamente después
de crearse, antes de esperar la indexación. El cleanup TTL borra en orden OpenAI
→ Storage → filas de documentos y conserva referencias si falla un borrado.
`analyze-with-agents` continúa desplegado únicamente como rollback SSE.

### Contexto que se carga solo cuando hace falta

Estas reglas viven en `.claude/rules/` con `paths:`, así que entran en contexto
únicamente al tocar los ficheros que cubren, en vez de en cada sesión:

| Regla                               | Se carga al tocar                                                  | Contenido                                                                    |
| ----------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `.claude/rules/agents-sdk.md`       | `supabase/functions/**`                                            | Índice de las reglas duras del SDK (fuente completa: `AGENTS.md`)            |
| `.claude/rules/pipeline-runtime.md` | `supabase/functions/**`, `job.service.ts`                          | Presupuesto de timeouts (`_shared/config.ts`) y tiempos típicos por tamaño   |
| `.claude/rules/ci-security.md`      | `.github/workflows/**`, `package.json`                             | OSV Scanner, pinning, bumps 0.x de Dependabot y aserciones de auth del smoke |
| `.claude/rules/agent-factory.md`    | `.github/workflows/agent-*.yml`, `scripts/agents/**`, `BACKLOG.md` | Los cuatro agentes autónomos, el flujo del backlog y el kill switch          |
| `.claude/rules/claude-config.md`    | `.claude/**`, `.mcp.json`                                          | Qué se versiona de `.claude/`, hook de arranque y dónde va cada prompt/regla |

Diagnóstico de despliegues y logs: skill `/observability`.

## Project Structure

Lo que no es evidente navegando el árbol:

- `src/` — React. `services/` es la lógica de negocio (job, db, auth, ai, template, quality); `config/` reúne env, supabase, sentry, features y service-registry.
- `supabase/functions/analysis-jobs/` — control plane con JWT: `init` (job + plan de subida firmado) y `submit` (verifica Storage y encola).
- `supabase/functions/analysis-worker/` — consumidor M2M de PGMQ por slices, con recovery `pg_cron` y cleanup TTL.
- `supabase/functions/analyze-with-agents/` — pipeline, hoy rollback SSE. `prompts/index.ts` son strings 1:1 de la implementación previa; `phases/` sigue el orden A→E; `agents/` son factories.
- `supabase/functions/_shared/` — `config.ts` centraliza modelo/timeouts/concurrencia, `schemas/canonical.ts` es la fuente de verdad, `agents/` el shim del SDK + guardrails + tracing.
- `scripts/` — solo automatización invocada desde `package.json`, `.github/workflows/` o `.husky/`: `verify-ci.sh` (`verify:release`) y `verify-integrity.ts` (drift + cobertura documental).

## Code Conventions

- **Package manager**: pnpm only (never npm or yarn)
- **Linting**: ESLint 9 con flat config (`eslint.config.js`), 0 warnings tolerados
- **Overrides de seguridad**: comprobar en OSV qué versiones corrige **el aviso concreto** antes de acotar un override por línea mayor. Si el aviso no tiene parche en la línea antigua (caso `brace-expansion`/`GHSA-mh99-v99m-4gvg`, corregido solo en 5.0.8), acotarlo reintroduce la vulnerabilidad: la salida es actualizar al consumidor incompatible, no relajar el override. Y un override fijado **no caduca solo**: `GHSA-rgw5-rvv9-x895` (2026-08-05) elude la mitigación del aviso anterior, así que ese mismo 5.0.8 volvió a estar afectado y hubo que subir a 5.0.9. Ante un HIGH en un paquete que ya tenía override, la pregunta no es «¿no lo habíamos arreglado?» sino «¿qué corrige **este** aviso?»
- **Backports transitivos**: si el consumidor y el override admiten una versión parcheada dentro de la misma línea, fijar esa resolución en el lockfile. Precedente: `GHSA-5p4m-2wfm-xmqj` se cerró con `js-yaml@4.3.1` bajo `@eslint/eslintrc@3.3.6`, sin salto a v5 ni excepción OSV. Mismo patrón, 2026-08-07b: `GHSA-4x5r-pxfx-6jf8` se cierra con `@babel/core >=7.29.7 <8`.
- **Overrides que cruzan un major**: cuando el aviso no tiene parche en la línea que arrastra el consumidor, el override salta de major y el audit en verde **no** es la verificación — solo dice que la versión ya no está listada. Hay que ejercitar al consumidor: cargar el módulo que importa el paquete y hacer un roundtrip real. Precedente: `GHSA-w5hq-g745-h8pq` obligó a `uuid >=11.1.1` (resuelve a 14.0.1) bajo `exceljs@4.4.0`, que declara `^8.3.2` y está sin mantenimiento; se comprobó que `cf-rule-ext-xform.js` —su único consumidor de `uuid`— carga, y que un `.xlsx` con formato condicional escribe y se relee.
- **Error handling**: `Result<T>` pattern (`ok`/`err`) in services, `safeParse` chains in consolidation
- **Imports in Edge Functions**: Use `npm:` specifiers (not `esm.sh`). The `@openai/agents` SDK is re-exported from `_shared/agents/sdk.ts` — importar siempre desde ahí, nunca con `npm:@openai/agents@x` directo (riesgo de múltiples instancias del SDK)
- **Backend constants**: All in `_shared/config.ts` (never hardcode model names, timeouts, etc.)
- **Agents**: ver `AGENTS.md` para el patrón de añadir un nuevo Agent o un nuevo guardrail
- **Auth en Edge Functions**: las tres funciones públicas dependen de `verify_jwt = true`; no añadir `--no-verify-jwt`. El worker conserva obligatoriamente su validación M2M Vault-backed y nunca acepta el token desde query/body.
- **Service role**: solo backend para mutar job/step/outbox/Storage. Nunca en `src/`, logs o responses. Browser = `SELECT` RLS de sus propios jobs/steps.
- **Durable step invariant**: job antes de efectos externos; bytes directos a Storage; enqueue mediante outbox; recursos OpenAI y salida reutilizable antes del ack; error mediante lease/retry/DLQ.
- **Perfil del licitador**: las tablas `empresa_*` son la excepción a «mutaciones backend-only» — las escribe el usuario, con políticas owner-scoped de lectura y escritura. Sus hijas cuelgan de `perfil_id`, **nunca** de `user_id`: `verify:integrity` lo comprueba estáticamente porque romperlo no da síntoma hasta el día de migrar a perfil de organización. Y ninguna columna de datos lleva `DEFAULT` numérico: «no lo sé» tiene que llegar distinguible de «cero» al motor de Go/No-Go.
- **Sin docs históricos sueltos**: el repo no mantiene archivos históricos no operativos (ej. `DEPRECATED.md`, `AUDIT.md`). El historial de cambios cerrados vive como entradas fechadas en `SPEC.md`, `ARCHITECTURE.md` (§8.x) y `CHANGELOG.md`.
- **Sin scripts de conveniencia muertos en `scripts/`**: cada `.sh` o `.ts` bajo `scripts/` debe estar invocado desde `package.json`, `.github/workflows/` o `.husky/`. Si no se usa desde uno de esos sitios, debe eliminarse en lugar de mantenerse "por si acaso".

## Database

- All exposed tables have RLS enabled. `analysis_jobs`, documents and steps expose only owner-scoped `SELECT`; all mutations are backend-only.
- Full-text search: `search_vector` tsvector column (Spanish) with GIN index
- Search RPC: `search_licitaciones` combines FTS + ILIKE fallback
- Key tables: `licitaciones`, `extraction_templates`, `analysis_jobs`, `analysis_job_documents`, `analysis_job_document_texts`, `analysis_job_steps`, `analysis_job_outbox`, `analysis_runtime_settings`, `extraction_feedback`
- `analysis_job_document_texts` es la excepción a «RLS con `SELECT` del dueño»: lleva RLS **sin políticas**, así que solo `service_role` la lee. Es el oráculo de verificación de citas (ADR-003), no dato de pantalla; añadirle un `SELECT` para `authenticated` expondría el texto completo del expediente al navegador sin que nada lo necesite

## Testing

- **Unit/Integration**: Vitest. Las puertas de cobertura y el histórico de subidas viven en `vitest.config.ts`; no se bajan sin justificarlo en el PR
- **Worker policy**: `vitest.config.ts` caps workers (`minWorkers: 1`, `maxWorkers: 2`) to keep `pnpm verify:release` stable under coverage and jsdom-heavy suites
- **Edge Function unit tests**: `deno test supabase/functions/<feature>/__tests__/*.test.ts` — los tests de guardrails están en `analyze-with-agents/__tests__/agents.test.ts`
- **E2E**: Playwright (Chromium, base URL localhost:4173)
- **Functional benchmark**: `pnpm benchmark:pliegos` validates minimum useful extraction over versioned fixtures
- **Pre-commit**: ESLint + Prettier on staged `.ts/.tsx` files

## Branch Policy

- Never commit directly to `main`
- Ephemeral branches per task
- PRs required with full CI passing
- QA validates before merge
- Production deploy runs only from `push` to `main` after merge and is blocked for direct pushes

## Deployment

1. Run `pnpm verify:release` in the working branch before pushing
2. Open or update a PR and wait for CI green
3. Merge the PR into `main`
4. GitHub Actions aplica migraciones y despliega Edge Functions antes de publicar el frontend en Vercel

## Monitoring & Observability

Skill `/observability` (`.claude/skills/observability/SKILL.md`): runs de GitHub
Actions vía `gh`, logs de Edge Functions y Postgres vía MCP de Supabase, deploys
de Vercel y spans `[trace]` del SDK correlacionados por `requestId`.

**Nunca hagas `source .env.local` para leer un token.** `gh` y el MCP de GitHub
se autentican solos; exportar el PAT al shell lo expone en transcripts y logs.
`.claude/settings.json` bloquea además la lectura de `.env*` con `permissions.deny`.

## Key Files to Know

- `src/lib/schemas.ts` — Frontend Zod schemas (LicitacionContent, TrackedField)
- `src/services/job.service.ts` — upload firmado, recovery Realtime/polling y rollback SSE
- `src/services/db.service.ts` — CRUD + search + delete
- `src/hooks/useHistory.ts` — History hook with debounced search
- `supabase/functions/analysis-jobs/index.ts` — control plane autenticado `init/submit`
- `supabase/functions/analysis-worker/index.ts` — consumidor durable, slices, retry/DLQ y cleanup
- `supabase/functions/analyze-with-agents/index.ts` — rollback SSE y orquestador A–E compatible
- `supabase/functions/analyze-with-agents/agents/*.agent.ts` — Agent factories
- `supabase/functions/analyze-with-agents/prompts/index.ts` — Prompt strings
- `supabase/functions/chat-with-analysis-agent/index.ts` — Conversational layer (verify_jwt=true en gateway)
- `supabase/functions/_shared/agents/{context,guardrails,tracing,sdk}.ts` — Infraestructura compartida del SDK
- `supabase/functions/_shared/document-text.ts` — Extracción local de texto: el oráculo contra el que se verifican las citas (ADR-003 Fase 2). `absenceIsConclusive()` es el único sitio que decide si una cita ausente puede declararse fabricada
- `supabase/functions/_shared/config.ts` — Backend constants
- `supabase/functions/_shared/schemas/canonical.ts` — Canonical schema (source of truth)
- `AGENTS.md` — Reglas duras del SDK (no `outputType` con `file_search`, per-request agents, Auth model, etc.). **Claude Code no lo auto-carga**: el índice de invariantes vive en `.claude/rules/agents-sdk.md` con scope `supabase/functions/**`

## Fábrica de agentes autónomos y configuración de `.claude/`

Cuatro agentes (PM, Tech, IA, QA) corren en GitHub Actions coordinados por
`BACKLOG.md`; el kill switch es la variable de repositorio `AGENTS_ENABLED`.
`.claude/` y `.mcp.json` **se versionan**. El detalle de ambos vive en
`.claude/rules/agent-factory.md` y `.claude/rules/claude-config.md`, que se
cargan solos al tocar esos ficheros, y en [`DEPLOYMENT.md`](./DEPLOYMENT.md).
