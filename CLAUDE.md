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
<!-- release-contract:end -->

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **Backend**: Supabase Edge Functions (Deno runtime) + `@openai/agents@0.3.1` SDK on top of OpenAI Responses API
- **DB**: PostgreSQL (Supabase) with RLS, FTS (Spanish), JSONB
- **Hosting**: Vercel (frontend), Supabase Cloud (backend)
- **CI/CD**: GitHub Actions (7-job pipeline)

### Key Patterns

- **TrackedField**: Critical fields use `{ value, status, evidence?, warnings? }` wrapper
- **Shared wire contract**: `src/shared/analysis-contract.ts` is the FE/BE source for SSE events, `TrackedFieldWire`, and `partial_reasons`
- **`unwrap()`**: Extracts raw value from TrackedField or passes through legacy values
- **SSE streaming**: Edge Function emits `heartbeat`, `phase_started`, `phase_completed`, `phase_progress`, `extraction_progress`, `retry_scheduled`, `complete`, `error`
- **Pipeline phases**: A:Ingestion -> B:DocumentMap -> C:BlockExtraction (3 concurrent + retries visibles) -> D:Consolidation -> E:Validation
- **`@openai/agents` (Fases B y C)**: cada fase con LLM construye `Agent<PipelineContext>` por request, con `fileSearchTool` y `jsonShapeGuardrail`. Detalles y reglas en [`AGENTS.md`](./AGENTS.md). El antiguo fallback Responses-API directo (`block-extraction.legacy.ts`) y el flag `USE_AGENTS_SDK` se eliminaron tras confirmar paridad en producción; revertir la migración requiere `git revert` del PR responsable.
- **Tracing**: `SupabaseLogTraceProcessor` emite `[trace]` JSON por evento del SDK. `grep '\[trace\]'` reconstruye la ejecución completa.
- **Auth**: `verify_jwt = true` en `supabase/config.toml` para **AMBAS** Edge Functions (`analyze-with-agents` y `chat-with-analysis-agent`). El gateway rechaza con 401 las peticiones sin JWT válido antes de invocar la función; el handler sólo resuelve `user` para rate-limit (analyze) y ownership (chat). El comando de despliegue NO debe llevar `--no-verify-jwt`. Detalle en `AGENTS.md` (Auth model) y `DEPLOYMENT.md` §5.
- **Primary product path**: The supported release path is one complete expediente PDF; partial docs are accepted but must surface structured `partial_reasons`

### Pipeline Timeout Architecture

The full pipeline runs in a single Supabase Edge Function invocation (SSE streaming).
Constants in `_shared/config.ts` control the timing budget:

| Constant | Value | Notes |
|---|---|---|
| `PIPELINE_TIMEOUT_MS` | 280 000 | Requires Supabase function timeout ≥ 300s (set in Dashboard → Project Settings → Edge Functions) |
| `API_CALL_TIMEOUT_MS` | 90 000 | Per-block agent run — no retry on timeout (timeouts are NOT retried, see `isRetryableError`) |
| `BLOCK_CONCURRENCY` | 3 | Extraction favors rate-limit stability over max concurrency |
| `VECTOR_STORE_TIMEOUT_MS` | 90 000 | Waits for `file_counts.in_progress === 0`, not `vs.status` |

**Typical timing by document size:**

| Pages | Ingestion | Extraction | Total |
|---|---|---|---|
| ~30 | ~20s | ~30-50s | ~70-90s ✅ |
| ~100 | ~40s | ~50-80s | ~120-150s ✅ |
| ~300 | ~90s | ~60-90s | ~200-250s ⚠️ needs 300s Supabase limit |

**⚠️ Architecture limitation for very large documents (300+ pages):**
The synchronous SSE pipeline has a hard ceiling at the Supabase wall-clock limit.
For documents where ingestion + indexing alone exceeds 90s, the pipeline budget
is consumed before extraction can complete.
**Future work**: Migrate to an async job model — edge function creates DB job record
and returns `job_id` immediately; background processing updates job status; client
polls `/status/:job_id` instead of SSE streaming.

### Security Audit CI

`pnpm audit` is not used (npm retired the `/v1/security/audits` endpoint).
Security scanning uses **OSV Scanner** which reads `pnpm-lock.yaml` directly against
Google's OSV database. Only HIGH/CRITICAL vulnerabilities fail CI.
The CI step parses JSON output and filters by `database_specific.severity`.

The `Smoke Test` job in `.github/workflows/ci-cd.yml` also asserts post-deploy
that `verify_jwt=true` is actually effective on both Edge Functions (a POST
without `Authorization` must return 401 from the gateway, otherwise the
deploy fails).

## Project Structure

```
src/                          # Frontend (React)
  features/                   # Feature modules (analytics, auth, dashboard, history)
  services/                   # Business logic (job, db, auth, ai, template, quality)
  stores/                     # Zustand stores
  hooks/                      # Custom hooks (useHistory, etc.)
  lib/                        # Schemas (Zod), utils, tracked-field helpers
  config/                     # Env, supabase, sentry, features, service-registry

supabase/functions/           # Backend (Deno Edge Functions)
  analyze-with-agents/        # Main pipeline
    agents/                   # Agent factories (document-map, block-extractor, custom-template)
    prompts/index.ts          # Prompt strings (1:1 desde la implementación previa)
    phases/                   # Pipeline phases (ingestion, document-map, block-extraction, consolidation, validation)
    __tests__/                # Tests Deno (deno test)
  _shared/                    # Shared utilities
    agents/                   # SDK shim, PipelineContext, guardrails, tracing
    config.ts                 # Centralized constants (model, timeouts, concurrency)
    schemas/                  # Canonical schemas (Zod)
    utils/                    # Error handling, timeout utility
    services/                 # Job service

supabase/migrations/          # SQL migrations (chronological)
scripts/                      # Repo automation invoked from package.json / CI
  verify-ci.sh                # `pnpm verify:release` entry point
  verify-integrity.ts         # `pnpm verify:integrity` (drift + doc coverage)
```

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
- **Sin docs históricos sueltos**: el repo no mantiene archivos históricos no operativos (ej. `DEPRECATED.md`, `AUDIT.md`). El historial de cambios cerrados vive como entradas fechadas en `SPEC.md`, `ARCHITECTURE.md` (§8.x) y `CHANGELOG.md`.
- **Sin scripts de conveniencia muertos en `scripts/`**: cada `.sh` o `.ts` bajo `scripts/` debe estar invocado desde `package.json`, `.github/workflows/` o `.husky/`. Si no se usa desde uno de esos sitios, debe eliminarse en lugar de mantenerse "por si acaso".

## Database

- All tables have RLS enabled (user isolation via `auth.uid() = user_id`)
- Full-text search: `search_vector` tsvector column (Spanish) with GIN index
- Search RPC: `search_licitaciones` combines FTS + ILIKE fallback
- Key tables: `licitaciones`, `extraction_templates`, `analysis_jobs`, `extraction_feedback`

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

### GitHub Actions (workflow runs, logs)
Requires `GITHUB_TOKEN` in `.env.local` — fine-grained PAT, Actions=Read + Contents=Read.
Create at: https://github.com/settings/personal-access-tokens/new

```bash
# Source vars then query GitHub API
source .env.local

# List recent workflow runs on main
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/$GITHUB_REPO/actions/runs?branch=main&per_page=5" \
  | jq '.workflow_runs[] | {id, status, conclusion, created_at, name: .display_title}'

# Get jobs for a specific run (replace RUN_ID)
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/$GITHUB_REPO/actions/runs/RUN_ID/jobs" \
  | jq '.jobs[] | {name, status, conclusion}'

# Get logs URL for a failed job (replace JOB_ID)
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/$GITHUB_REPO/actions/jobs/JOB_ID/logs"
```

### Supabase (edge functions, DB logs)
Use Supabase MCP tools (project_id: `qsohtrvnlimymwdxiokm`):
- `list_edge_functions` → deployment status and version
- `get_logs(service: "edge-function")` → real-time invocation logs
- `get_logs(service: "postgres")` → DB query logs
- `execute_sql` → direct DB inspection

### Vercel (frontend)
Deployment status visible via GitHub PR checks ("Deployment has completed").

### SDK trace spans
Every agent run emits structured `[trace]` lines via `SupabaseLogTraceProcessor`:

```bash
npx supabase functions logs analyze-with-agents --tail | grep '\[trace\]'
```

Filtering by `requestId` (also threaded into `[analyze]` log lines as
`reqId=...`) correlates SSE events, application logs, and SDK spans for a
single request.

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
- `AGENTS.md` — Reglas duras del SDK (no `outputType` con `file_search`, per-request agents, Auth model, etc.)
