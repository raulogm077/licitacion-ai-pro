# Deployment actual

Este documento describe el proceso vigente de despliegue. No describe la arquitectura legacy de colas.

<!-- release-contract:start -->

- No direct work or deploy from `main`.
- Production deploys only after a green PR is merged into `main`.
- Every session that changes code, runtime, workflows, hooks, or deploy surfaces must end with `pnpm verify:release`.
- If a change touches workflows, hooks, release process, migrations, SSE, `JobService`, `analyze-with-agents`, or other user-visible behavior, the matching docs and instruction files must be updated in the same branch.
- Release-facing changes in the analysis runtime or contract must also keep `pnpm benchmark:pliegos` green before push/PR.

<!-- release-contract:end -->

## 1. Qué se despliega

Superficies desplegables principales:

- frontend de la aplicación
- Edge Function `analyze-with-agents`
- Edge Function `chat-with-analysis-agent` para conversación sobre análisis persistidos

> **Nota (rediseño UX «Iris», 2026-07-12):** las dependencias frontend de UI añadidas (`motion`, `sonner`, `recharts`, `canvas-confetti`, `tailwindcss-animate`, `@fontsource-variable/*`) son **solo de cliente**: entran en el bundle de Vite/Vercel y **no** afectan al runtime Deno de las Edge Functions (que no las importa). Las fuentes se sirven self-hosted desde el bundle, sin CDN externa.

## 2. Quién puede desplegar

- **Solo QA** valida el cierre operativo dentro del flujo nocturno.
- El despliegue productivo no se lanza manualmente desde ramas efímeras.
- GitHub Actions despliega producción únicamente tras merge de una PR verde en `main`.

## 3. Preconditions obligatorias

Antes de desplegar una tarea, QA debe verificar:

1. `pnpm verify:release`
2. `pnpm benchmark:pliegos` si la tarea toca `analyze-with-agents`, SSE, contrato compartido o dashboard del análisis
3. PR con CI en verde
4. si la tarea es IA:
    - compatibilidad con la Guía de lectura de pliegos
    - compatibilidad con SSE
    - compatibilidad con schema/Zod
5. documentación mínima actualizada

## 3.1. Gate funcional de release

El despliegue productivo no se considera seguro solo porque lint, tests unitarios y build estén en verde. Cambios que afecten al análisis deben mantener verde el benchmark funcional:

```bash
pnpm benchmark:pliegos
```

Ese benchmark valida fixtures versionados con mínimos por campo y sección. El caso principal soportado para producción es un único PDF completo del expediente; los documentos parciales siguen aceptándose, pero deben quedar clasificados como `PARCIAL` con razones estructuradas.

Cambios recientes protegidos por ese gate:

- reconciliación canónica de `datosGenerales.presupuesto` y `datosGenerales.plazoEjecucionMeses` cuando la señal fiable está en `economico` o `duracionYProrrogas`
- preservación de `criteriosAdjudicacion` cuando llegan `subcriterios` mal formados
- diagnóstico estructurado por sección en `workflow.quality.section_diagnostics` para distinguir ausencia documental frente a degradación del pipeline

## 4. Migraciones de base de datos

Antes de desplegar código que dependa de nuevas tablas o columnas, la rama debe validar que no hay deriva con producción:

```bash
pnpm verify:integrity
```

El despliegue productivo aplica las migraciones pendientes desde GitHub Actions:

```bash
npx supabase db push --include-all
```

Migraciones relevantes recientes:

- `20260329000000_fulltext_search.sql` — Columna `search_vector` (tsvector español), índice GIN, función RPC `search_licitaciones`
- `20260419015401_analysis_chat_tables.sql` — tablas `analysis_chat_sessions` y `analysis_chat_messages` con RLS
- `20260712000000_fix_search_licitaciones_idor.sql` — corrige un IDOR en la RPC `search_licitaciones`: pasa a `search_licitaciones(search_query text)` de un solo argumento, `SECURITY INVOKER` (aplica RLS) con filtro `auth.uid()` y `search_path` fijo; endurece además el `search_path` de las funciones trigger `update_updated_at_column` y `update_extraction_templates_updated_at`. El frontend no cambia (ya llamaba solo con `search_query`)

> **Nota**: `db push` es no destructivo para migraciones nuevas, pero revisar siempre el plan antes de aplicar en producción.

## 5. Comando de despliegue de la Edge Function

```bash
npx supabase functions deploy analyze-with-agents
npx supabase functions deploy chat-with-analysis-agent
```

> **Ambas funciones usan `verify_jwt = true`** en `supabase/config.toml`. El gateway de Supabase rechaza con 401 las peticiones sin JWT válido antes de invocar el código de la función. Dentro de cada handler sólo se resuelve el `user` con `supabase.auth.getUser(token)` para rate-limiting (en `analyze-with-agents`) y ownership sobre `licitaciones` / `analysis_chat_sessions` (en `chat-with-analysis-agent`).
>
> Si en algún caso futuro hubiera que rebajar la postura para una función concreta, fijar `verify_jwt = false` en `[functions.<nombre>]` de `config.toml` y añadir `--no-verify-jwt` al comando — nunca con un solo cambio sin el otro.

> **Límites del chat (desde 2026-07-12)**: `chat-with-analysis-agent` aplica rate limiting por usuario (`CHAT_MAX_REQUESTS_PER_HOUR=60`) y rechaza bodies mayores que `MAX_CHAT_PAYLOAD_BYTES=64KB`; ambas constantes viven en `_shared/config.ts`. El modelo del chat es la constante `CHAT_MODEL` (no hardcodeado) y el SDK se importa solo vía `_shared/agents/sdk.ts`. En `analyze-with-agents` el límite de payload valida la longitud real del body, no el header `content-length`. Detalle en `TECHNICAL_DOCS.md` §4-§5.

### 5.1. Validación local de las Edge Functions

Antes de desplegar:

```bash
deno check --node-modules-dir=auto supabase/functions/analyze-with-agents/index.ts
deno check --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/index.ts
deno test --allow-env --node-modules-dir=auto supabase/functions/analyze-with-agents/__tests__/agents.test.ts
deno test --allow-env --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/tools_test.ts
```

### 5.2. Smoke test de seguridad post-deploy

Tras desplegar, comprobar que `verify_jwt=true` está efectivo en ambas funciones:

```bash
curl -i -X POST "$SUPABASE_URL/functions/v1/analyze-with-agents" \
  -H 'Content-Type: application/json' \
  -d '{"pdfBase64":""}'

curl -i -X POST "$SUPABASE_URL/functions/v1/chat-with-analysis-agent" \
  -H 'Content-Type: application/json' \
  -d '{"analysisHash":"x","message":"x"}'
```

Las dos deben responder `401` desde el gateway (sin invocar el código de la función). Si responden `400` u otro código, revertir a la rama anterior — la validación JWT no está en su sitio. El job `Smoke Test` del workflow `ci-cd.yml` automatiza esta verificación en cada deploy a `main`.

### 5.3. Toolchain de CI fijado (desde 2026-07-12)

`ci-cd.yml` y los `agent-*.yml` comparten toolchain: `actions/checkout@v6`, `actions/setup-node@v6`, `pnpm/action-setup@v4` y **Node 22**. Las herramientas externas quedan pineadas (sin `latest`) para builds reproducibles: OSV scanner `v2.4.0`, actionlint `v1.7.9`, supabase CLI `2.99.0`, vercel `55.0.0`. El job `edge-checks` cablea los tests Deno (`consolidation_test`, `validation_test`, `agents.test`, `canonical_test`, `retry_test`, `tracing_test`), también invocados desde `scripts/verify-ci.sh`.

## 6. Secretos y configuración

`OPENAI_API_KEY` debe estar configurada como secreto de Supabase para ambas Edge Functions. No debe exponerse en el frontend.

Ejemplo de configuración:

```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
```

No hay otros secretos backend operativos. Cualquier secret remoto huérfano (ej. `USE_AGENTS_SDK`, eliminado del código el 2026-05-09) puede borrarse con `supabase secrets unset <NAME>` sin afectar runtime.

## 7. Validación posterior al despliegue

Después del despliegue, QA debe comprobar al menos:

- que ambas funciones figuran en el listado de Supabase
- que no hay errores inmediatos de ejecución
- que el flujo principal sigue respondiendo como mínimo en un smoke test sobre un pliego representativo del camino principal (PDF completo)
- que en los logs de `analyze-with-agents` aparecen entradas con prefijo `[trace]` (al menos 1 por cada fase B y C) — verifica que el `SupabaseLogTraceProcessor` está activo
- que tanto `analyze-with-agents` como `chat-with-analysis-agent` responden `401` ante un POST sin JWT (smoke automático en §5.2)

Comandos útiles:

```bash
npx supabase functions list
npx supabase functions logs analyze-with-agents --tail | grep '\[trace\]'
npx supabase functions logs chat-with-analysis-agent --tail
```

## 8. Rollback operativo

Si el despliegue introduce una regresión:

- la tarea debe volver a `## To Do` con `🐛 BUG:` y log asociado en `BACKLOG.md`
- se debe preparar una nueva tarea correctiva
- la documentación debe recoger el riesgo o incidencia si aplica
- si la regresión es del pipeline `analyze-with-agents` (Fase B o C) → `git revert` del PR responsable y abrir issue inmediatamente. Ya no existe el flag `USE_AGENTS_SDK` que permitía alternar entre el camino SDK y el legacy sin redeploy.
- si la regresión es de auth (peticiones legítimas rechazadas con 401) → cambiar `verify_jwt = false` en `[functions.<nombre>]` de `config.toml`, redesplegar con `--no-verify-jwt`, y abrir issue para diagnosticar antes de revertir

## 9. Regla documental

Si cambia el proceso real de despliegue, este archivo debe actualizarse antes de cerrar la tarea correspondiente.

## 10. Disciplina de archivos en `scripts/`

Cualquier script bajo `scripts/` debe ser invocado desde `package.json`, `.github/workflows/` o `.husky/`. La verificación mínima:

- `verify-ci.sh` → invocado por `pnpm verify:release` (entry point del cierre obligatorio antes de push/PR).
- `verify-integrity.ts` → invocado por `pnpm verify:integrity` y por el job `Repo Integrity` del workflow.

Si un script futuro deja de usarse desde alguno de esos sitios, debe eliminarse en lugar de mantenerse "por si acaso". El repo no conserva scripts de conveniencia muertos.

## Fábrica de agentes autónomos (Claude Code en GitHub Actions)

El repo ejecuta cuatro agentes autónomos con `anthropics/claude-code-action@v1`,
coordinados por `BACKLOG.md` y sin intervención humana. Cada rol tiene un
workflow en `.github/workflows/` (`agent-pm.yml`, `agent-tech.yml`,
`agent-ia.yml`, `agent-qa.yml`) y su prompt operativo en
`.claude/commands/agent-<rol>.md`.

| Workflow         | Rol             | Qué hace                                                                                 | Cron (UTC)              |
| ---------------- | --------------- | ---------------------------------------------------------------------------------------- | ----------------------- |
| `agent-pm.yml`   | Product Manager | Audita, refina y prioriza el backlog; nunca programa ni despliega.                       | `30 5 * * 1-5`          |
| `agent-tech.yml` | Tech Lead       | Implementa la primera tarea **no** `[Tipo: AI]` de `## To Do`; TDD + `verify:release`.   | `0 7` y `30 11 * * 1-5` |
| `agent-ia.yml`   | Senior IA       | Implementa la primera tarea `[Tipo: AI]` (prompts, schemas, SSE, `analyze-with-agents`). | `15 7 * * 1-5`          |
| `agent-qa.yml`   | QA              | Valida `## Ready for QA` sobre `main` y confirma que el pipeline quedó verde.            | `30 15 * * 1-5`         |

**Coordinación vía `BACKLOG.md`.** Los agentes se pasan el trabajo por las
secciones del backlog: `## To Do (Iteración Actual)` → `## In Progress` →
`## Ready for QA` → `## Done`. El tag `[Tipo: AI]` enruta una tarea al agente IA
(el resto las toma Tech). `scripts/agents/guard.sh <rol>` decide antes de
arrancar si la sesión merece la pena: **no** lanza si ya hay un PR abierto de ese
rol (serialización sin humanos) ni si no hay tareas elegibles en su sección
(ahorro directo de tokens), escribiendo `run=true|false` en `GITHUB_OUTPUT`.

**Integración (auto-merge) apoyada en el CI existente.** Cada agente abre su PR y
ejecuta `gh pr merge --auto --squash`; GitHub integra el PR **solo cuando el
pipeline `Productive CI/CD Pipeline` (`.github/workflows/ci-cd.yml`) termina en
verde**. Ningún agente despliega a mano: el propio pipeline despliega Vercel y
Supabase tras el merge a `main` (con `release-guard` exigiendo que venga de un PR
mergeado). El check de integridad que debe exigir la protección de rama es el job
`repo-integrity` de ese pipeline (más `e2e-tests` cuando se active E2E).

**Kill switch: variable de repositorio `AGENTS_ENABLED`.** Los jobs corren solo
si `vars.AGENTS_ENABLED == 'true'` **o** el disparo es `workflow_dispatch`
(manual). Con `AGENTS_ENABLED=false` la fábrica se detiene en el siguiente cron;
`Run workflow` desde la pestaña Actions salta el kill switch para pruebas
controladas. Para parar algo ya en marcha: Actions → Cancel.

**MCP.** `.mcp.json` declara `supabase` (en `--read-only`; los agentes investigan,
no mutan) y `context7` (documentación versionada). El único camino de escritura a
producción sigue siendo el deploy del pipeline tras el merge.

### Configuración de repositorio requerida (manual, fuera de esta rama)

Estos ajustes tocan secretos y protección de rama y **no** se aplican por PR:

- **Secrets** (Settings → Secrets and variables → Actions): `ANTHROPIC_API_KEY`,
  `AGENTS_PAT`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`.
- **Variables**: `AGENTS_ENABLED` (arranque en frío en `false`) y
  `SUPABASE_PROJECT_REF`.
- **`AGENTS_PAT` (crítico)**: GitHub no dispara workflows sobre eventos creados
  con el `GITHUB_TOKEN` por defecto (protección anti-recursión). Los agentes
  hacen `checkout` y `gh pr create/merge` con un fine-grained PAT (Contents,
  Pull requests y Workflows en RW, idealmente de una cuenta-bot) para que su PR
  **sí** dispare el CI y el auto-merge funcione.
- **Pull Requests**: Settings → General → ✅ Allow auto-merge (+ Allow squash
  merging).
- **Branch protection de `main`**: Require PR before merging y Require status
  checks → `repo-integrity` (añade `e2e-tests` al activar E2E). Workflow
  permissions en Read and write.

## Orden de migraciones y Supabase Preview (resuelto 2026-07-12)

`add_provider_reading_mode` tenía un timestamp (`20250130000000`, 2025-01-30)
**anterior** al de `20251228000000_initial_schema.sql`, que crea la tabla
`licitaciones`. En un apply en frío (el *branching preview* de Supabase, que
reaplica todas las migraciones sobre una BD vacía) corría antes de crear la
tabla y fallaba con `relation "public.licitaciones" does not exist`. No afectaba
a producción (`db push --include-all` sobre la BD existente salta las
migraciones ya registradas en `supabase_migrations.schema_migrations`).

**Corregido** renombrando el fichero a `20251229000000_add_provider_reading_mode.sql`
(posterior a `initial_schema`) e idempotentizándolo (`ADD COLUMN IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS` y `DO $$ ... $$` guardando los `ADD CONSTRAINT`), y
reparando el historial remoto (equivalente a
`supabase migration repair --status reverted 20250130000000`): se eliminó la
fila `20250130000000` de `schema_migrations` para que el deploy re-aplique la
migración idempotente bajo el nuevo `version` y la registre. El check
`Supabase Preview` vuelve a pasar.

> **Patrón para futuras migraciones**: el nombre de fichero debe ordenar
> cronológicamente por encima de todas las migraciones de las que dependa. Si
> hay que reordenar una ya aplicada, renombrar + idempotentizar + `migration
> repair` (o el `delete` equivalente sobre `schema_migrations`).
