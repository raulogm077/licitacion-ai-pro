---
name: observability
description: Inspecciona el estado de despliegue y los logs de Analista de Pliegos — runs de GitHub Actions, logs de Edge Functions y Postgres en Supabase, deploys de Vercel y spans `[trace]` del SDK. Úsala cuando haya que diagnosticar un CI en rojo, un deploy fallido, un análisis que no completa, o correlacionar SSE ↔ logs ↔ trace por `requestId`.
---

# Monitoring & Observability

> **Nunca hagas `source .env.local` ni exportes `GITHUB_TOKEN` al shell.** Ese
> fichero contiene un PAT y el entorno del shell acaba en transcripts y logs.
> Usa `gh` (que gestiona su propia credencial) o el MCP de GitHub.

## GitHub Actions (workflow runs, logs)

Vía `gh` CLI, que ya usan los workflows de la fábrica de agentes:

```bash
# Últimos runs en main
gh run list --branch main --limit 5

# Detalle de un run (jobs y conclusión de cada uno)
gh run view <RUN_ID>

# Logs solo de los pasos que fallaron
gh run view <RUN_ID> --log-failed
```

En sesiones cloud sin `gh`, usa las herramientas MCP de GitHub (`actions_list`,
`actions_get`, `get_job_logs`), que se autentican por la sesión.

## Supabase (edge functions, DB logs)

Herramientas MCP de Supabase (project_id: `qsohtrvnlimymwdxiokm`, servidor en
modo `--read-only`):

- `list_edge_functions` → estado de despliegue y versión
- `get_logs(service: "edge-function")` → logs de invocación en tiempo real
- `get_logs(service: "postgres")` → logs de queries
- `execute_sql` → inspección directa de la DB
- `get_advisors` → avisos de seguridad/rendimiento

## Vercel (frontend)

El estado del deploy se ve en los checks del PR ("Deployment has completed").

## SDK trace spans

Cada run de agente emite líneas `[trace]` estructuradas vía
`SupabaseLogTraceProcessor`:

```bash
npx supabase functions logs analyze-with-agents --tail | grep '\[trace\]'
```

Filtrar por `requestId` (que también viaja en las líneas `[analyze]` como
`reqId=...`) correlaciona eventos SSE, logs de aplicación y spans del SDK de una
sola petición.
