# Integrity Audit, Runtime Cleanup, and Real Validation

This plan is a living document. It exists to drive a full integrity pass over the product: remove dead artifacts, verify the app locally with real build/test commands, validate the agentic surfaces, and run a real-user flow with `memo_p2.pdf` when network access and authentication are available.

## Purpose / Big Picture

After this work, the repository should contain only files that materially support the product, the local verification stack should pass, CI/CD should match the real product surfaces, and there should be evidence that the app can process a real tender PDF and expose the result correctly in the UI. The main outcome is confidence: less dead code, fewer maintenance traps, and a validation trail that covers both mocked E2E and a real runtime path.

## Progress

- [x] (2026-04-18 19:12Z) Audited current branch state and identified the relevant changed surfaces (`chat-with-analysis-agent`, dashboard chat integration, CI/CD, docs).
- [x] (2026-04-18 19:13Z) Verified the new chat integration perimeter locally with `tsc`, targeted `vitest`, `deno check`, and `deno test`.
- [x] (2026-04-19 01:53Z) Removed dead operational artifacts (`plan.md`, `pm_*.py`, `test-plan.js`) and deleted the obsolete `chat-agent-spike` Edge Function plus its doc/CI references.
- [ ] Run the full local validation stack: lint, typecheck, unit tests, build, E2E.
- [ ] Execute a real validation flow with `memo_p2.pdf` against the linked Supabase project using an authenticated session.
- [ ] Reconcile CI/CD with the final repository shape and deployable surfaces.

## Surprises & Discoveries

- Observation: the repository already had a productive conversational Edge Function (`chat-with-analysis-agent`) plus a separate technical spike (`chat-agent-spike`), but only the productive function had been integrated into the UI.
  Evidence: `src/services/analysis-chat.service.ts` now consumes `chat-with-analysis-agent`; `chat-agent-spike` had no frontend consumer.

- Observation: the local shell does not expose `pnpm` or `corepack` in `PATH`, even though the project is pnpm-based.
  Evidence: `pnpm` and `corepack` returned `command not found`; verification used local binaries under `node_modules/.bin/`.

- Observation: no `.env.local` was present, so real runtime validation requires either temporary env injection or the linked Supabase project directly.
  Evidence: `.env.local missing`; `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` were unset in the shell.

## Decision Log

- Decision: keep the productive chat path and treat the spike as a cleanup candidate rather than a product feature.
  Rationale: the productive function already persists sessions and is now wired into the dashboard, while the spike adds maintenance cost without user-facing value.
  Date/Author: 2026-04-18 / Codex

- Decision: use local project binaries (`./node_modules/.bin/...`) for verification instead of relying on missing global package managers.
  Rationale: this keeps validation reproducible inside the current environment without mutating the machine setup.
  Date/Author: 2026-04-18 / Codex

## Outcomes & Retrospective

Pending. This section will be updated after cleanup, full validation, and the real `memo_p2.pdf` execution.

## Context and Orientation

The product has two major runtime surfaces:

1. `supabase/functions/analyze-with-agents/`
   This is the main analysis pipeline. It handles PDF ingestion, vector store indexing, structured extraction, SSE progress, consolidation, and validation.

2. `supabase/functions/chat-with-analysis-agent/`
   This is the conversational layer over already persisted analyses. It does not process PDFs; it reads existing `licitaciones` rows, reconstructs chat history from `analysis_chat_sessions` and `analysis_chat_messages`, and returns `answer`, `citations`, `usedTools`, and `sessionId`.

The frontend uses the analysis pipeline through `src/services/job.service.ts` and now uses the conversational layer through `src/services/analysis-chat.service.ts` plus `src/features/analysis-chat/components/AnalysisChatPanel.tsx`.

The repository also contains several likely-cleanup candidates:

- `supabase/functions/chat-agent-spike/` — technical spike with no product consumer.
- `pm_analysis.py`, `pm_script.py`, `pm_script2.py` — ad-hoc backlog helper scripts with no references.
- `plan.md` — stale one-off execution note not connected to current work.
- `Guia Lectura de Pliegos .pdf` — original source PDF that appears superseded by `supabase/functions/analyze-with-agents/guia-lectura-pliegos.md`.

These candidates must be deleted only after reference checks confirm that they are not required by product code, tests, CI, or operational docs.

## Plan of Work

First, confirm dead artifacts by searching for references and reading their contents. Delete only the ones with zero product value and update docs/CI accordingly if they referenced those artifacts.

Second, run the full local integrity stack from the repo root using the installed local binaries: lint, typecheck, unit tests, build, Deno checks/tests, and Playwright E2E. If E2E requires `pnpm`, provide a temporary wrapper or equivalent execution path that does not alter repository behavior.

Third, perform a real runtime validation with `memo_p2.pdf`. This requires a valid Supabase JWT, so the run will use the linked Supabase project (`qsohtrvnlimymwdxiokm`) and a temporary authenticated user. The browser flow should upload the real PDF, wait for the backend result, and then exercise the dashboard and, if possible, the chat panel on the persisted analysis.

Fourth, review `.github/workflows/ci-cd.yml` against the final repository shape. If the spike is removed, delete its Deno checks and deployment references. Keep deployment steps aligned with the actual productive Edge Functions.

## Concrete Steps

From `/tmp/licitacion-ai-pro`:

1. Search for references to cleanup candidates and productive agentic surfaces.
2. Remove verified-dead artifacts with targeted patches.
3. Run:
   - `./node_modules/.bin/eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`
   - `./node_modules/.bin/tsc --noEmit`
   - `./node_modules/.bin/vitest --run`
   - `./node_modules/.bin/vite build`
   - `deno check --node-modules-dir=auto supabase/functions/analyze-with-agents/index.ts`
   - `deno check --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/index.ts`
   - `deno test --allow-env --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/tools_test.ts`
4. Run Playwright E2E with a reproducible local server strategy.
5. If network access is granted, create or sign in a temporary Supabase user, boot the local app with real Supabase env vars, upload `memo_p2.pdf`, and capture the observable result.

## Validation and Acceptance

Acceptance requires all of the following:

- The repository no longer contains dead files/folders that have no references and no operational value.
- The local integrity stack passes.
- The chat integration still compiles and the targeted tests pass.
- The E2E suite passes in local execution or any blocking failure is isolated with concrete evidence.
- A real runtime test with `memo_p2.pdf` reaches the app, executes the backend path, and produces a usable analysis result in the UI.
- CI/CD reflects only productive surfaces and does not validate or deploy dead artifacts.

## Idempotence and Recovery

Cleanup must be patch-based and reversible by Git. Runtime validation should prefer temporary env injection rather than committed local secrets. Any temporary authenticated user created for testing should be disposable and documented in the final notes.

## Artifacts and Notes

Pending. This section will hold the exact command results and the evidence from the real `memo_p2.pdf` run.

## Interfaces and Dependencies

- Frontend analysis runtime: `src/services/job.service.ts`
- Frontend chat runtime: `src/services/analysis-chat.service.ts`
- Dashboard integration: `src/features/dashboard/Dashboard.tsx`
- Productive conversational backend: `supabase/functions/chat-with-analysis-agent/`
- Main analysis backend: `supabase/functions/analyze-with-agents/`
- CI/CD workflow: `.github/workflows/ci-cd.yml`

Revision note: created this plan to drive a combined cleanup + validation pass after the conversational dashboard integration landed and before claiming repository integrity.
