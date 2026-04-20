#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$ROOT_DIR/node_modules/.bin"

run_verify_integrity() {
  node --experimental-strip-types "$ROOT_DIR/scripts/verify-integrity.ts"
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

echo "→ Edge Functions (deno check)..."
deno check --node-modules-dir=auto supabase/functions/analyze-with-agents/index.ts
deno check --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/index.ts

echo "→ Edge Functions (deno test)..."
deno test --node-modules-dir=auto supabase/functions/_shared/schemas/canonical_test.ts
deno test --node-modules-dir=auto supabase/functions/_shared/utils/retry_test.ts
deno test --allow-env --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/tools_test.ts

echo "→ E2E..."
"$BIN_DIR/playwright" test

echo "verify:release completado."
