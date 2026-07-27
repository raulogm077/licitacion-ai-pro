# CLAUDE.md — Project Conventions for Claude Code

## Project Overview

Analista de Pliegos: SaaS app for analyzing Spanish public procurement documents (pliegos de licitacion) using AI. Extracts structured data from PDFs via a 5-phase pipeline.

## Quick Commands

```bash
pnpm dev              # Dev server (localhost:5173)
pnpm build            # TypeScript check + Vite build
pnpm typecheck        # TypeScript strict check
pnpm test -- --run    # Run all 236+ tests (single run)
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
- **Backend**: Supabase Edge Functions (Deno runtime) + `@openai/agents@0.3.1` SDK on top of OpenAI Responses API
- **DB**: PostgreSQL (Supabase) with RLS, FTS (Spanish), JSONB
- **Hosting**: Vercel (frontend), Supabase Cloud (backend)
- **CI/CD**: GitHub Actions (7-job pipeline)

### Key Patterns

- **TrackedField**: Critical fields use `{ value, status, evidence?, warnings? }` wrapper
- **Shared wire contract**: `src/shared/analysis-contract.ts` is the FE/BE source for SSE events, `TrackedFieldWire`, and `partial_reasons`; `job_created` is always the first durable event
- **`unwrap()`**: Extracts raw value from TrackedField or passes through legacy values
- **SSE + recovery**: Edge Function emits `job_created`, `heartbeat`, phase events, `complete`/`error`; frontend polls `analysis_jobs` by `jobId` if the stream closes early
- **Durable jobs**: user-scoped idempotency + input fingerprint, recoverable Storage copy, `analysis_job_steps`, transactional outbox, private PGMQ queue, lease/retry/DLQ
- **Pipeline phases**: A:Ingestion -> B:DocumentMap -> C:BlockExtraction (3 concurrent + retries visibles) -> D:Consolidation -> E:Validation
- **`@openai/agents` (Fases B y C)**: cada fase con LLM construye `Agent<PipelineContext>` por request, con `fileSearchTool` y `jsonShapeGuardrail`. Detalles y reglas en [`AGENTS.md`](./AGENTS.md). El antiguo fallback Responses-API directo (`block-extraction.legacy.ts`) y el flag `USE_AGENTS_SDK` se eliminaron tras confirmar paridad en producción; revertir la migración requiere `git revert` del PR responsable.
- **Tracing**: `SupabaseLogTraceProcessor` emite `[trace]` JSON por evento del SDK. `grep '\[trace\]'` reconstruye la ejecución completa.
- **Auth**: `verify_jwt = true` en `supabase/config.toml` para **AMBAS** Edge Functions (`analyze-with-agents` y `chat-with-analysis-agent`). El gateway rechaza con 401 las peticiones sin JWT válido antes de invocar la función; el handler sólo resuelve `user` para rate-limit (analyze) y ownership (chat). El comando de despliegue NO debe llevar `--no-verify-jwt`. Detalle en `AGENTS.md` (Auth model) y `DEPLOYMENT.md` §5.
- **Primary product path**: The supported release path is one complete expediente PDF; partial docs are accepted but must surface structured `partial_reasons`

### Contexto que se carga solo cuando hace falta

Estas reglas viven en `.claude/rules/` con `paths:`, así que entran en contexto
únicamente al tocar los ficheros que cubren, en vez de en cada sesión:

| Regla                              | Se carga al tocar                            | Contenido                                                                    |
| ---------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| `.claude/rules/agents-sdk.md`      | `supabase/functions/**`                      | Índice de las reglas duras del SDK (fuente completa: `AGENTS.md`)            |
| `.claude/rules/pipeline-runtime.md` | `supabase/functions/**`, `job.service.ts`   | Presupuesto de timeouts (`_shared/config.ts`) y tiempos típicos por tamaño   |
| `.claude/rules/ci-security.md`     | `.github/workflows/**`, `package.json`       | OSV Scanner, pinning, bumps 0.x de Dependabot y aserción `verify_jwt`        |

Diagnóstico de despliegues y logs: skill `/observability`.

## Project Structure

Lo que no es evidente navegando el árbol:

- `src/` — React. `services/` es la lógica de negocio (job, db, auth, ai, template, quality); `config/` reúne env, supabase, sentry, features y service-registry.
- `supabase/functions/analyze-with-agents/` — pipeline. `prompts/index.ts` son strings 1:1 de la implementación previa; `phases/` sigue el orden A→E; `agents/` son factories.
- `supabase/functions/_shared/` — `config.ts` centraliza modelo/timeouts/concurrencia, `schemas/canonical.ts` es la fuente de verdad, `agents/` el shim del SDK + guardrails + tracing.
- `scripts/` — solo automatización invocada desde `package.json`, `.github/workflows/` o `.husky/`: `verify-ci.sh` (`verify:release`) y `verify-integrity.ts` (drift + cobertura documental).

## Code Conventions

- **Language**: TypeScript strict mode everywhere
- **Package manager**: pnpm only (never npm or yarn)
- **Formatting**: Prettier (enforced by pre-commit hook via Husky + lint-staged)
- **Linting**: ESLint with 0 warnings tolerance
- **Schemas**: Zod for both frontend and backend validation
- **Error handling**: `Result<T>` pattern (`ok`/`err`) in services, `safeParse` chains in consolidation
- **Imports in Edge Functions**: Use `npm:` specifiers (not `esm.sh`). The `@openai/agents` SDK is re-exported from `_shared/agents/sdk.ts` — importar siempre desde ahí, nunca con `npm:@openai/agents@x` directo (riesgo de múltiples instancias del SDK)
- **Backend constants**: All in `_shared/config.ts` (never hardcode model names, timeouts, etc.)
- **Agents**: ver `AGENTS.md` para el patrón de añadir un nuevo Agent o un nuevo guardrail
- **Auth en Edge Functions**: NO reintroducir validación manual del token. Las dos funciones se apoyan en `verify_jwt = true` del gateway. Añadir `--no-verify-jwt` al `supabase functions deploy` invalida silenciosamente esta postura (sobrescribe `config.toml`).
- **Service role**: solo backend para mutar job/step/outbox/Storage. Nunca en `src/`, logs o responses. Browser = `SELECT` RLS de sus propios jobs/steps.
- **Durable step invariant**: job antes de efectos externos; enqueue mediante outbox; archive solo después del checkpoint; error mediante lease/retry/DLQ.
- **Sin docs históricos sueltos**: el repo no mantiene archivos históricos no operativos (ej. `DEPRECATED.md`, `AUDIT.md`). El historial de cambios cerrados vive como entradas fechadas en `SPEC.md`, `ARCHITECTURE.md` (§8.x) y `CHANGELOG.md`.
- **Sin scripts de conveniencia muertos en `scripts/`**: cada `.sh` o `.ts` bajo `scripts/` debe estar invocado desde `package.json`, `.github/workflows/` o `.husky/`. Si no se usa desde uno de esos sitios, debe eliminarse en lugar de mantenerse "por si acaso".

## Database

- All exposed tables have RLS enabled. `analysis_jobs`, documents and steps expose only owner-scoped `SELECT`; all mutations are backend-only.
- Full-text search: `search_vector` tsvector column (Spanish) with GIN index
- Search RPC: `search_licitaciones` combines FTS + ILIKE fallback
- Key tables: `licitaciones`, `extraction_templates`, `analysis_jobs`, `analysis_job_steps`, `analysis_job_outbox`, `extraction_feedback`

## Testing

- **Unit/Integration**: Vitest (236+ tests, coverage thresholds: 65% statements, 50% branches)
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
4. GitHub Actions deploys Supabase + Vercel from `main`

## Monitoring & Observability

Skill `/observability` (`.claude/skills/observability/SKILL.md`): runs de GitHub
Actions vía `gh`, logs de Edge Functions y Postgres vía MCP de Supabase, deploys
de Vercel y spans `[trace]` del SDK correlacionados por `requestId`.

**Nunca hagas `source .env.local` para leer un token.** `gh` y el MCP de GitHub
se autentican solos; exportar el PAT al shell lo expone en transcripts y logs.
`.claude/settings.json` bloquea además la lectura de `.env*` con `permissions.deny`.

## Key Files to Know

- `src/lib/schemas.ts` — Frontend Zod schemas (LicitacionContent, TrackedField)
- `src/services/job.service.ts` — SSE streaming orchestration
- `src/services/db.service.ts` — CRUD + search + delete
- `src/hooks/useHistory.ts` — History hook with debounced search
- `supabase/functions/analyze-with-agents/index.ts` — Pipeline orchestrator (registra `setTraceProcessors` y construye `PipelineContext`)
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
