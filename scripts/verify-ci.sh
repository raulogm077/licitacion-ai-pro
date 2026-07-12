#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$ROOT_DIR/node_modules/.bin"

run_verify_integrity() {
  node --import tsx "$ROOT_DIR/scripts/verify-integrity.ts"
}

echo "Iniciando verify:release..."

echo "→ Integridad del repo..."
run_verify_integrity

echo "→ Lint..."
"$BIN_DIR/eslint" . --ext ts,tsx --report-unused-disable-directives --max-warnings 0

echo "→ TypeScript..."
"$BIN_DIR/tsc" --noEmit

echo "→ Unit tests + coverage..."
"$BIN_DIR/vitest" --run --coverage

echo "→ Benchmark funcional..."
node --import tsx benchmarks/pliegos/run.ts

echo "→ Build..."
"$BIN_DIR/tsc"
"$BIN_DIR/vite" build

# E2E runs BEFORE the Deno steps: `deno ... --node-modules-dir=auto` repoints
# node_modules/.bin to its own managed copies, which makes a subsequent
# Playwright run fail with "two different versions of @playwright/test" when
# both share one local node_modules. CI is unaffected (edge-checks and
# e2e-tests are separate jobs), but the local aggregate must run Playwright
# first.
echo "→ E2E..."
"$BIN_DIR/playwright" test

echo "→ Edge Functions (deno check)..."
deno check --node-modules-dir=auto supabase/functions/analyze-with-agents/index.ts
deno check --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/index.ts

echo "→ Edge Functions (deno test)..."
deno test --node-modules-dir=auto supabase/functions/_shared/schemas/canonical_test.ts
deno test --node-modules-dir=auto supabase/functions/_shared/utils/retry_test.ts
deno test --node-modules-dir=auto supabase/functions/_shared/agents/tracing_test.ts
deno test --allow-env --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/tools_test.ts
deno test --node-modules-dir=auto supabase/functions/analyze-with-agents/phases/ingestion_test.ts
deno test --node-modules-dir=auto supabase/functions/analyze-with-agents/phases/consolidation_test.ts
deno test --node-modules-dir=auto supabase/functions/analyze-with-agents/phases/validation_test.ts
deno test --allow-env --node-modules-dir=auto supabase/functions/analyze-with-agents/__tests__/agents.test.ts

echo "verify:release completado."
