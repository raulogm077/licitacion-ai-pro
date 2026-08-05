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

Un override fijado tampoco es definitivo. `GHSA-rgw5-rvv9-x895` (2026-08-05)
elude la mitigación del aviso anterior de `brace-expansion`, así que el 5.0.8 que
se había fijado para cerrarlo volvió a estar afectado sin tocar nada del repo; la
salida fue `>=5.0.9`. Ante un HIGH en un paquete que **ya tiene override**,
consultar el aviso por su ID —`curl https://api.osv.dev/v1/vulns/<GHSA>`— y leer
sus cortes `fixed` por línea, en vez de suponer que el override sigue cubriendo.

The `Smoke Test` job in `.github/workflows/ci-cd.yml` also asserts post-deploy
that the auth posture is actually effective: un POST sin `Authorization` debe
devolver 401 del gateway en las tres funciones públicas (`analyze-with-agents`,
`chat-with-analysis-agent` y `analysis-jobs`), y `analysis-worker` debe devolver
401 de autenticación M2M cuando se le llama sin su token. Si alguna responde
otra cosa, el deploy falla.

## Pinning

Toda herramienta externa invocada desde CI o desde `.mcp.json` va pineada a una
versión concreta, nunca a `@latest` (OSV Scanner `v2.4.0`,
`@supabase/mcp-server-supabase`). Reproducibilidad y superficie de supply chain.

## Dependabot: los 0.x no respetan semver

El grupo `dev-dependencies` de `.github/dependabot.yml` agrupa `minor` y `patch`,
lo cual es seguro **salvo en paquetes 0.x**, donde un salto de minor sí puede ser
breaking. Ya ocurrió (caso cerrado con la migración a ESLint 9 el 2026-07-27):
`eslint-plugin-react-refresh` 0.4→0.5 cambió su
peerDependency a `eslint: ^9 || ^10`, el plugin dejó de registrar sus reglas bajo
ESLint 8 y `pnpm lint` se cayó con 184 errores de regla no encontrada.

Cuando un bump de 0.x rompa, el patrón es: fijar la línea en `package.json`
(`~0.4.26`, no `^`), añadir el `ignore` correspondiente en `dependabot.yml` **con
el motivo escrito**, y registrar en `BACKLOG.md` la tarea que permitirá quitarlo.
Un `ignore` sin fecha ni tarea asociada se convierte en deuda invisible.
