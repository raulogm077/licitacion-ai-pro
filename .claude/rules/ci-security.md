---
paths:
    - '.github/workflows/**'
    - 'package.json'
    - 'pnpm-lock.yaml'
---

# Security Audit CI

`pnpm audit` is not used (npm retired the `/v1/security/audits` endpoint).
Security scanning uses **OSV Scanner** (pinned to `v2.4.0`) which reads
`pnpm-lock.yaml` directly against Google's OSV database. Only HIGH/CRITICAL
vulnerabilities fail CI. The CI step parses JSON output and filters by
`database_specific.severity`. Transitive HIGH/CRITICAL findings are remediated
via `pnpm.overrides` in `package.json` (e.g. `tmp`, `ws`, `brace-expansion`,
`js-yaml`); direct deps are bumped in place (e.g. `vite`, `postcss`).

Cuando un finding **no** tiene versión parcheada alcanzable, la excepción va en
`osv-scanner.toml` con `reason` y `ignoreUntil` obligatorios — nunca ampliando el
filtro de severidad ni tocando el `jq` del workflow. Al caducar `ignoreUntil` el
finding vuelve a romper el CI, que es justo lo que se quiere: una excepción que
nadie revisa es una vulnerabilidad aceptada en silencio. Un override que fija un
rango abierto (`>=X`) resuelve al máximo publicado y puede arrastrar un major sin
querer; acotar (`>=4.3.0 <5.0.0`) cuando basta con la línea actual.

The `Smoke Test` job in `.github/workflows/ci-cd.yml` also asserts post-deploy
that `verify_jwt=true` is actually effective on both Edge Functions (a POST
without `Authorization` must return 401 from the gateway, otherwise the
deploy fails).

## Pinning

Toda herramienta externa invocada desde CI o desde `.mcp.json` va pineada a una
versión concreta, nunca a `@latest` (OSV Scanner `v2.4.0`,
`@supabase/mcp-server-supabase`). Reproducibilidad y superficie de supply chain.
