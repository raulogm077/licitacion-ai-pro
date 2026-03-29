# CLAUDE.md — Project Conventions for Claude Code

## Project Overview

Analista de Pliegos: SaaS app for analyzing Spanish public procurement documents (pliegos de licitacion) using AI. Extracts structured data from PDFs via a 5-phase pipeline.

## Quick Commands

```bash
pnpm dev              # Dev server (localhost:5173)
pnpm build            # TypeScript check + Vite build
pnpm typecheck        # TypeScript strict check
pnpm test -- --run    # Run all 236+ tests (single run)
pnpm test:e2e         # Playwright E2E tests
pnpm lint             # ESLint (0 warnings allowed)
pnpm format           # Prettier auto-fix
pnpm format:check     # Prettier check
```

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **Backend**: Supabase Edge Functions (Deno runtime) + OpenAI Responses API
- **DB**: PostgreSQL (Supabase) with RLS, FTS (Spanish), JSONB
- **Hosting**: Vercel (frontend), Supabase Cloud (backend)
- **CI/CD**: GitHub Actions (7-job pipeline)

### Key Patterns

- **TrackedField**: Critical fields use `{ value, status, evidence?, warnings? }` wrapper
- **`unwrap()`**: Extracts raw value from TrackedField or passes through legacy values
- **SSE streaming**: Edge Function emits phase events (heartbeat, phase_started, phase_completed, complete, error)
- **Pipeline phases**: A:Ingestion -> B:DocumentMap -> C:BlockExtraction (3 concurrent) -> D:Consolidation -> E:Validation

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
    phases/                   # Pipeline phases (ingestion, document-map, block-extraction, consolidation, validation)
    prompts.ts                # Prompts per phase
  _shared/                    # Shared utilities
    config.ts                 # Centralized constants (model, timeouts, concurrency)
    schemas/                  # Canonical schemas (Zod)
    utils/                    # Error handling, timeout utility
    services/                 # Job service

supabase/migrations/          # SQL migrations (chronological)
```

## Code Conventions

- **Language**: TypeScript strict mode everywhere
- **Package manager**: pnpm only (never npm or yarn)
- **Formatting**: Prettier (enforced by pre-commit hook via Husky + lint-staged)
- **Linting**: ESLint with 0 warnings tolerance
- **Schemas**: Zod for both frontend and backend validation
- **Error handling**: `Result<T>` pattern (`ok`/`err`) in services, `safeParse` chains in consolidation
- **Imports in Edge Functions**: Use `npm:` specifiers (not `esm.sh`)
- **Backend constants**: All in `_shared/config.ts` (never hardcode model names, timeouts, etc.)

## Database

- All tables have RLS enabled (user isolation via `auth.uid() = user_id`)
- Full-text search: `search_vector` tsvector column (Spanish) with GIN index
- Search RPC: `search_licitaciones` combines FTS + ILIKE fallback
- Key tables: `licitaciones`, `extraction_templates`, `analysis_jobs`, `extraction_feedback`

## Testing

- **Unit/Integration**: Vitest (236+ tests, coverage thresholds: 65% statements, 50% branches)
- **E2E**: Playwright (Chromium, base URL localhost:4173)
- **Pre-commit**: ESLint + Prettier on staged `.ts/.tsx` files

## Branch Policy

- Never commit directly to `main`
- Ephemeral branches per task
- PRs required with full CI passing
- QA validates before merge

## Deployment

1. `npx supabase db push --include-all` (apply migrations)
2. `npx supabase functions deploy analyze-with-agents --no-verify-jwt` (JWT validated internally)
3. Frontend deploys automatically via Vercel on merge to `main`

## Key Files to Know

- `src/lib/schemas.ts` — Frontend Zod schemas (LicitacionContent, TrackedField)
- `src/services/job.service.ts` — SSE streaming orchestration
- `src/services/db.service.ts` — CRUD + search + delete
- `src/hooks/useHistory.ts` — History hook with debounced search
- `supabase/functions/analyze-with-agents/index.ts` — Pipeline orchestrator
- `supabase/functions/_shared/config.ts` — Backend constants
- `supabase/functions/_shared/schemas/canonical.ts` — Canonical schema (source of truth)
