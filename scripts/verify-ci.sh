#!/bin/bash
set -euo pipefail

echo "Iniciando verify:release..."

echo "→ Integridad del repo..."
pnpm verify:integrity

echo "→ Lint..."
pnpm lint

echo "→ TypeScript..."
pnpm typecheck

echo "→ Unit tests + coverage..."
pnpm test -- --run --coverage

echo "→ Build..."
pnpm build

echo "→ Edge Functions (deno check)..."
deno check --node-modules-dir=auto supabase/functions/analyze-with-agents/index.ts
deno check --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/index.ts

echo "→ Edge Functions (deno test)..."
deno test --node-modules-dir=auto supabase/functions/_shared/schemas/canonical_test.ts
deno test --node-modules-dir=auto supabase/functions/_shared/utils/retry_test.ts
deno test --allow-env --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/tools_test.ts

echo "→ E2E..."
pnpm test:e2e

echo "verify:release completado."
