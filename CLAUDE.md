# CLAUDE.md — Project Conventions for Claude Code

## Project Overview

Analista de Pliegos: SaaS app for analyzing Spanish public procurement documents (pliegos de licitacion) using AI. Extracts structured data from PDFs via a 5-phase pipeline.

## Quick Commands

```bash
pnpm dev              # Dev server (localhost:5173)
pnpm build            # TypeScript check + Vite build
pnpm typecheck        # TypeScript strict check
pnpm test -- --run    # Run the full unit suite once (471 tests / 64 suites)
pnpm benchmark:pliegos # Benchmark funcional del caso principal de producto
pnpm test:e2e         # Playwright E2E tests
pnpm lint             # ESLint (0 warnings allowed)
pnpm format           # Prettier auto-fix
pnpm format:check     # Prettier check
pnpm verify:integrity # Drift de migraciones + workflows + docs/instructions
pnpm verify:release   # Cierre obligatorio de sesión antes de push/PR
```

<!-- release-contract:start -->

- No direct work or deploy from `main`.
- Production deploys only after a green PR is merged into `main`.
- Every session that changes code, runtime, workflows, hooks, or deploy surfaces must end with `pnpm verify:release`.
- If a change touches workflows, hooks, release process, migrations, SSE, `JobService`, `analyze-with-agents`, or other user-visible behavior, the matching docs and instruction files must be updated in the same branch.
- Release-facing changes in the analysis runtime or contract must also keep `pnpm benchmark:pliegos` green before push/PR.
- AI runtime changes must keep `pnpm eval:pliegos:check` green and record a manual `pnpm eval:pliegos:live` baseline before model, prompt, retrieval, or orchestration promotion.

<!-- release-contract:end -->

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

| Regla                              | Se carga al tocar                            | Contenido                                                                    |
| ---------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| `.claude/rules/agents-sdk.md`      | `supabase/functions/**`                      | Índice de las reglas duras del SDK (fuente completa: `AGENTS.md`)            |
| `.claude/rules/pipeline-runtime.md` | `supabase/functions/**`, `job.service.ts`   | Presupuesto de timeouts (`_shared/config.ts`) y tiempos típicos por tamaño   |
| `.claude/rules/ci-security.md`     | `.github/workflows/**`, `package.json`       | OSV Scanner, pinning, bumps 0.x de Dependabot y aserciones de auth del smoke |

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

- **Language**: TypeScript strict mode everywhere
- **Package manager**: pnpm only (never npm or yarn)
- **Formatting**: Prettier (enforced by pre-commit hook via Husky + lint-staged)
- **Linting**: ESLint 9 con flat config (`eslint.config.js`), 0 warnings tolerados
- **Overrides de seguridad**: acotar por línea mayor (`brace-expansion@1`) cuando la API cambia entre majors; un override global a la última versión rompe a quien usa la API antigua
- **Schemas**: Zod for both frontend and backend validation
- **Error handling**: `Result<T>` pattern (`ok`/`err`) in services, `safeParse` chains in consolidation
- **Imports in Edge Functions**: Use `npm:` specifiers (not `esm.sh`). The `@openai/agents` SDK is re-exported from `_shared/agents/sdk.ts` — importar siempre desde ahí, nunca con `npm:@openai/agents@x` directo (riesgo de múltiples instancias del SDK)
- **Backend constants**: All in `_shared/config.ts` (never hardcode model names, timeouts, etc.)
- **Agents**: ver `AGENTS.md` para el patrón de añadir un nuevo Agent o un nuevo guardrail
- **Auth en Edge Functions**: las tres funciones públicas dependen de `verify_jwt = true`; no añadir `--no-verify-jwt`. El worker conserva obligatoriamente su validación M2M Vault-backed y nunca acepta el token desde query/body.
- **Service role**: solo backend para mutar job/step/outbox/Storage. Nunca en `src/`, logs o responses. Browser = `SELECT` RLS de sus propios jobs/steps.
- **Durable step invariant**: job antes de efectos externos; bytes directos a Storage; enqueue mediante outbox; recursos OpenAI y salida reutilizable antes del ack; error mediante lease/retry/DLQ.
- **Sin docs históricos sueltos**: el repo no mantiene archivos históricos no operativos (ej. `DEPRECATED.md`, `AUDIT.md`). El historial de cambios cerrados vive como entradas fechadas en `SPEC.md`, `ARCHITECTURE.md` (§8.x) y `CHANGELOG.md`.
- **Sin scripts de conveniencia muertos en `scripts/`**: cada `.sh` o `.ts` bajo `scripts/` debe estar invocado desde `package.json`, `.github/workflows/` o `.husky/`. Si no se usa desde uno de esos sitios, debe eliminarse en lugar de mantenerse "por si acaso".

## Database

- All exposed tables have RLS enabled. `analysis_jobs`, documents and steps expose only owner-scoped `SELECT`; all mutations are backend-only.
- Full-text search: `search_vector` tsvector column (Spanish) with GIN index
- Search RPC: `search_licitaciones` combines FTS + ILIKE fallback
- Key tables: `licitaciones`, `extraction_templates`, `analysis_jobs`, `analysis_job_documents`, `analysis_job_steps`, `analysis_job_outbox`, `analysis_runtime_settings`, `extraction_feedback`

## Testing

- **Unit/Integration**: Vitest (471 tests, coverage gates: 82% statements, 70% branches, 81% functions, 83% lines — el histórico de subidas vive en `vitest.config.ts`)
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
- `supabase/functions/_shared/config.ts` — Backend constants
- `supabase/functions/_shared/schemas/canonical.ts` — Canonical schema (source of truth)
- `AGENTS.md` — Reglas duras del SDK (no `outputType` con `file_search`, per-request agents, Auth model, etc.). **Claude Code no lo auto-carga**: el índice de invariantes vive en `.claude/rules/agents-sdk.md` con scope `supabase/functions/**`

## Fábrica de agentes autónomos

Cuatro agentes (PM, Tech, IA, QA) corren en GitHub Actions
(`.github/workflows/agent-*.yml`) con `anthropics/claude-code-action@v1`, guiados
por los prompts de `.claude/commands/agent-*.md` y coordinados por `BACKLOG.md`
(`## To Do` → `## In Progress` → `## Ready for QA` → `## Done`; el tag `[Tipo: AI]`
enruta al agente IA). `scripts/agents/guard.sh` serializa por rol y evita sesiones
sin tareas. El auto-merge (`gh pr merge --auto --squash`) depende del CI existente
`Productive CI/CD Pipeline`; el kill switch es la variable de repositorio
`AGENTS_ENABLED`. Cada workflow invoca su prompt con `prompt: '/agent-<rol>'`.
Cualquier cambio en `.github/workflows/agent-*.yml` o en `scripts/agents/`
arrastra los cuatro docs de release (`verify:integrity` lo exige). Detalle en
[`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Configuración de Claude Code (`.claude/`)

`.claude/` y `.mcp.json` **se versionan**: CI y las sesiones cloud clonan el repo,
así que lo que no esté commiteado no existe allí. El `.gitignore` solo excluye
`.claude/settings.local.json`.

- `settings.json` — hook `SessionStart` (`matcher: startup|resume`, no reinstala en cada `/clear`) y `permissions.deny` sobre `.env*`
- `hooks/session-start.sh` — `pnpm install`, `.env.local`, symlinks de Playwright
- `commands/agent-*.md` — prompts de la fábrica, con `disable-model-invocation: true`
- `rules/*.md` — contexto con `paths:`, se carga solo al tocar sus ficheros
- `skills/` — `/observability` y las skills de `.agents/skills/` vía symlink

Al añadir prompts, reglas o skills: van bajo `.claude/`, nunca en un `skills/` de
raíz (Claude Code no lee esa ruta). Y ojo con los patrones de `.gitignore` sin
barra inicial: `skills/` captura también `.claude/skills/`; hay que anclar
(`/skills/`).
