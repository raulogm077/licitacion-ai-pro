# Deployment actual

Este documento describe el proceso vigente de despliegue del control plane, worker durable y superficies de compatibilidad.

<!-- release-contract:start -->

- No direct work or deploy from `main`.
- Production deploys only after a green PR is merged into `main`.
- Every session that changes code, runtime, workflows, hooks, or deploy surfaces must end with `pnpm verify:release`.
- If a change touches workflows, hooks, release process, migrations, SSE, `JobService`, `analyze-with-agents`, or other user-visible behavior, the matching docs and instruction files must be updated in the same branch.
- Release-facing changes in the analysis runtime or contract must also keep `pnpm benchmark:pliegos` green before push/PR.
- AI runtime changes must keep `pnpm eval:pliegos:check` green and record a manual `pnpm eval:pliegos:live` baseline before model, prompt, retrieval, or orchestration promotion. The baseline is compared with `pnpm eval:pliegos:diff`, which refuses to compare runs from different datasets and exits non-zero on any per-case regression.

<!-- release-contract:end -->

## 1. Qué se despliega

Superficies desplegables principales:

- frontend de la aplicación
- Edge Function `analysis-jobs` (control plane autenticado)
- Edge Function `analysis-worker` (consumidor interno M2M)
- Edge Function `analyze-with-agents` (rollback SSE durante Fase 1B)
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
    - `pnpm eval:pliegos:check` en verde
    - baseline de `pnpm eval:pliegos:live` si cambia modelo, prompt, retrieval u orquestación
    - `pnpm eval:pliegos:diff <baseline.json>` contra esa baseline, sin regresiones
5. documentación mínima actualizada

> `verify:release` es repetible desde 2026-08-05. Antes lo era solo la primera vez: los pasos Deno dejan `node_modules/.deno` y repuntan los enlaces de `node_modules/.bin`, así que la siguiente ejecución —o cualquier `deno test` suelto lanzado entre medias— moría en el paso de Playwright con «two different versions of @playwright/test», mucho antes de llegar a los pasos Deno que lo causaron. El script ahora limpia ese residuo antes del E2E. En CI no aplica: `edge-checks` y `e2e-tests` son jobs distintos con su propio `node_modules`.

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

## 3.2. Evaluación semántica real de IA

El benchmark funcional no llama al modelo: valida fixtures canónicos ya generados. Los cambios de IA necesitan además dos capas:

```bash
pnpm eval:pliegos:check
pnpm eval:pliegos:live
```

La primera es determinista, no consume red y forma parte de `verify:release`. La segunda ejecuta las fases A-E reales contra OpenAI, registra modelo/versiones/fingerprint, latencias y métricas de hechos, ausencias y grounding, y elimina Files/Vector Stores al finalizar. Sus resultados viven en `evals/results/`, ignorado por Git; el artefacto baseline debe conservarse en la evidencia de QA o de la PR, nunca con contenido sensible ni credenciales.

El eval live es obligatorio antes de promover cambios en modelo, prompts, retrieval u orquestación. No se ejecuta automáticamente en CI para evitar consumo de API y exposición innecesaria de secretos en ramas no confiables.

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
- `20260716101822_analysis_jobs_durable_foundation.sql` — PGMQ, ledger/outbox de pasos, idempotencia, copias recuperables en Storage y RPC backend-only. Debe pasar primero por Supabase Preview; no aplicar manualmente en producción.
- `20260716105353_analysis_job_advisor_hardening.sql` — índices de las FK del outbox y política RLS deny explícita; cierra los tres avisos introducidos detectados por advisors en el preview de la PR.
- `20260716114116_analysis_worker_async_runtime.sql` — `pg_net`/`pg_cron`, token M2M en Vault, upload state/orden, claim/advance atómicos, activación y recovery del worker, Broadcast privado y cleanup TTL. Debe validarse en Preview antes de producción; no contiene una API key de OpenAI ni un token en texto plano versionado.
- `20260717094234_harden_pg_net_extension_schema.sql` — garantiza que `pg_net` quede registrado en `extensions`; repara de forma idempotente previews que ya lo hubieran instalado en `public` y evita introducir un aviso del Security Advisor.
- `20260805120000_analysis_job_document_texts.sql` — tabla `analysis_job_document_texts`: el texto extraído localmente de cada documento, oráculo de verificación de citas (ADR-003 Fase 2). **RLS activo y sin políticas** a propósito, de modo que solo `service_role` la lee; no añadir un `SELECT` para `authenticated` sin una pantalla que lo necesite, porque expondría el texto completo del expediente al navegador. Tabla aparte —y no columnas en `analysis_job_documents`— porque esa tabla se lee en cada slice del worker y un `text` de cientos de KB dentro convertiría cualquier `select('*')` futuro en megabytes por slice. El borrado va en cascada desde el documento, así que el cleanup TTL existente ya la vacía sin cambios.

> **Nota**: `db push` es no destructivo para migraciones nuevas, pero revisar siempre el plan antes de aplicar en producción.

El proyecto productivo está actualmente en plan Free: las Edge Functions tienen 150 s de wall clock. El worker usa lease de 155 s y slices acotadas; no subir `EXTRACTION_BLOCKS_PER_SLICE` ni unir ingesta+mapa sin revalidar el límite y el eval live. Referencia: <https://supabase.com/docs/guides/functions/limits>.

## 5. Comando de despliegue de la Edge Function

El orden es contractual: primero migraciones, después las cuatro funciones y
solo entonces Vercel. Así la UI nueva nunca apunta a un control plane todavía
inexistente. `ci-cd.yml` expresa esa dependencia (`deploy-vercel` necesita
`deploy-supabase`).

```bash
npx supabase functions deploy analyze-with-agents
npx supabase functions deploy analysis-jobs
npx supabase functions deploy analysis-worker
npx supabase functions deploy chat-with-analysis-agent
```

> **`analysis-jobs`, `analyze-with-agents` y `chat-with-analysis-agent` usan `verify_jwt = true`**. `analysis-worker` es la única excepción: usa `verify_jwt = false` y valida `x-analysis-worker-token` contra el digest guardado en `analysis_runtime_settings`. El texto plano se genera en la migración y solo vive en Vault.
> No rebajar JWT en las funciones públicas ni retirar la autenticación M2M del worker como workaround operativo. Cualquier cambio de postura requiere revisión de seguridad y smoke equivalente.

> **Límites del chat (desde 2026-07-12)**: `chat-with-analysis-agent` aplica rate limiting por usuario (`CHAT_MAX_REQUESTS_PER_HOUR=60`) y rechaza bodies mayores que `MAX_CHAT_PAYLOAD_BYTES=64KB`; ambas constantes viven en `_shared/config.ts`. El modelo del chat es la constante `CHAT_MODEL` (no hardcodeado) y el SDK se importa solo vía `_shared/agents/sdk.ts`. En `analyze-with-agents` el límite de payload valida la longitud real del body, no el header `content-length`. Detalle en `TECHNICAL_DOCS.md` §4-§5.

### 5.1. Validación local de las Edge Functions

Antes de desplegar:

```bash
deno check --node-modules-dir=auto supabase/functions/analyze-with-agents/index.ts
deno check --node-modules-dir=auto supabase/functions/analysis-jobs/index.ts
deno check --node-modules-dir=auto supabase/functions/analysis-worker/index.ts
deno check --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/index.ts
deno test --allow-env --node-modules-dir=auto supabase/functions/analyze-with-agents/__tests__/agents.test.ts
deno test supabase/functions/_shared/services/durable-input.service_test.ts supabase/functions/_shared/services/job.service_test.ts
deno test --allow-env --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/tools_test.ts
```

### 5.2. Smoke test de seguridad post-deploy

Tras desplegar, comprobar gateway JWT en las funciones públicas y auth M2M en el worker:

```bash
curl -i -X POST "$SUPABASE_URL/functions/v1/analyze-with-agents" \
  -H 'Content-Type: application/json' \
  -d '{"pdfBase64":""}'

curl -i -X POST "$SUPABASE_URL/functions/v1/chat-with-analysis-agent" \
  -H 'Content-Type: application/json' \
  -d '{"analysisHash":"x","message":"x"}'

curl -i -X POST "$SUPABASE_URL/functions/v1/analysis-jobs" \
  -H 'Content-Type: application/json' \
  -d '{"action":"init"}'

curl -i -X POST "$SUPABASE_URL/functions/v1/analysis-worker" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Las tres públicas deben responder `401` desde el gateway. El worker también debe responder `401`, pero desde su handler por ausencia del token M2M. El job `Smoke Test` automatiza ambas posturas y valida además el CORS de `analysis-jobs`.

### 5.3. Toolchain de CI fijado (desde 2026-07-12)

`ci-cd.yml` y los `agent-*.yml` comparten toolchain: `actions/checkout@v6`, `actions/setup-node@v6`, `pnpm/action-setup@v4` y **Node 22**. Las herramientas externas quedan pineadas (sin `latest`) para builds reproducibles: OSV scanner `v2.4.0`, actionlint `v1.7.9`, supabase CLI `2.99.0`, vercel `55.0.0`. El job `edge-checks` cablea los tests Deno (`ingestion_test / consolidation_test`, `validation_test`, `agents.test`, `canonical_test`, `retry_test`, `tracing_test`), también invocados desde `scripts/verify-ci.sh`.

**Bumps de Dependabot que rompen sin ser majors.** El grupo `dev-dependencies` agrupa `minor` y `patch`, y eso es seguro salvo en paquetes `0.x`, donde un minor sí puede ser breaking. Precedente registrado: `eslint-plugin-react-refresh` 0.4→0.5 movió su peerDependency a `eslint: ^9 || ^10`; bajo ESLint 8 el plugin no registra sus reglas y `pnpm lint` cae con 184 errores de «Definition for rule not found». El patrón ante un caso así es fijar la línea en `package.json` (`~0.4.26`, no `^`), añadir el `ignore` en `.github/dependabot.yml` **con el motivo escrito**, y abrir la tarea en `BACKLOG.md` que permita retirarlo — un `ignore` sin tarea asociada es deuda invisible. Ese caso concreto se cerró el 2026-07-27 con la migración a ESLint 9 + flat config, y su `ignore` se retiró; el patrón sigue vigente para el próximo.

**Excepciones del Security Audit.** El job `security-audit` corre OSV Scanner desde la raíz del repo, así que descubre `osv-scanner.toml` automáticamente. Ese fichero es el único sitio donde se silencia un finding, y solo cuando no hay versión parcheada alcanzable: cada entrada exige `reason` (por qué no aplica y por qué no se puede actualizar) e `ignoreUntil` (fecha tras la cual vuelve a romper el CI). Lo que sí tiene parche se arregla actualizando —`pnpm.overrides` para transitivos, bump directo para dependencias declaradas—, nunca añadiéndolo aquí. Ampliar el filtro de severidad o tocar el `jq` del workflow para dejar pasar un HIGH no es una remediación válida.

**Un override fijado no es una remediación permanente.** El 2026-08-05 el CI cayó con `GHSA-rgw5-rvv9-x895` sobre `brace-expansion@5.0.8` — exactamente la versión que se había fijado semanas antes para cerrar `GHSA-mh99-v99m-4gvg`. El aviso nuevo describe un DoS que **elude la mitigación** del anterior, así que la versión «parcheada» dejó de serlo sin que nada cambiase en el repo. El arreglo fue subir el override a `>=5.0.9`, el corte que OSV da para la línea 4.x+ de ese aviso concreto.

**Backport alcanzable en una dependencia transitiva.** El 2026-08-07 `GHSA-5p4m-2wfm-xmqj` afectó a `js-yaml@4.3.0`, introducido por `@eslint/eslintrc@3.3.6`. El override existente ya admitía la línea corregida y la dependencia consumidora declara `^4.3.0`, por lo que la remediación mínima fue regenerar el lockfile con `js-yaml@4.3.1`. No se cambió runtime, no hubo salto a `js-yaml` 5 y no se añadió una excepción a `osv-scanner.toml`.

**Cuando el parche solo existe cruzando un major.** El 2026-08-07 `GHSA-w5hq-g745-h8pq` afectó a `uuid@8.3.2`, que introduce `exceljs@4.4.0` declarando `^8.3.2`. El aviso no tiene corte en la línea 8.x: las versiones corregidas empiezan en 11.1.1. Acotar el override a la línea antigua habría reintroducido la vulnerabilidad, así que se fijó `uuid: ">=11.1.1"`, que resuelve a 14.0.1 — seis majors por encima de lo que el consumidor declara, y `exceljs` está sin mantenimiento, así que no habrá una versión suya que lo acompañe.

Ahí el `pnpm audit` en verde **no es la verificación**: solo dice que la versión instalada ya no está en la lista del aviso, no que el consumidor siga funcionando con ella. La comprobación que sí vale es ejercitar al consumidor. En este caso: localizar el único módulo de `exceljs` que importa `uuid` (`lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js`), cargarlo explícitamente para que un cambio de exports o un paquete vuelto ESM-only falle ahí, y hacer un roundtrip real —escribir un `.xlsx` con formato condicional y releerlo— antes de dar el override por bueno. El rango se acota por arriba (`>=11.1.1 <15`) aunque el corte inferior sea el del aviso: un `>=X` abierto resuelve siempre al máximo publicado, así que el día que salga `uuid` 15 entraría sola, sin la verificación funcional que justificó el salto. El techo conserva la resolución que sí se ejercitó. El mismo día, `GHSA-4x5r-pxfx-6jf8` (`@babel/core`) se cerró por el camino barato: `>=7.29.7 <8`, dentro de la misma línea, sin verificación funcional adicional más allá del build y la suite.

Lo operativo: cuando el `security-audit` señala un paquete que **ya tiene override**, no se asume que el override esté roto ni que el finding sea un falso positivo. Se consulta el aviso por su ID (`https://api.osv.dev/v1/vulns/<GHSA>`), se leen sus cortes por línea y se sube al que corresponda. Que el CI lo detecte es el mecanismo funcionando: es la única alarma que existe para un aviso que aparece después de la mitigación.

## 6. Secretos y configuración

`OPENAI_API_KEY` debe estar configurada como secreto de Supabase para `analysis-worker`, `analyze-with-agents` y `chat-with-analysis-agent`. No debe exponerse en el frontend.

`analysis-jobs`, `analysis-worker` y el rollback `analyze-with-agents` usan además `SUPABASE_SERVICE_ROLE_KEY` para mutaciones backend. Es un secreto integrado que Supabase inyecta automáticamente: no se copia a `.env`, no se devuelve al cliente y no se configura como secreto personalizado.

Ejemplo de configuración:

```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
```

<<<<<<< HEAD
`EDGE_WALL_CLOCK_MS` es el único secret opcional. Declara el techo de wall-clock que la plataforma impone a una invocación de Edge Function, del que se deriva `PIPELINE_TIMEOUT_MS`. **No es un valor que elijamos nosotros**: hay que ponerlo igual al que esté configurado en Dashboard → Project Settings → Edge Functions → Function Timeout.

| Plan         | Techo real  | Sin el secret                            | Con el secret ajustado              |
| ------------ | ----------- | ---------------------------------------- | ----------------------------------- |
| Free         | 150 s       | 140 s de pipeline (correcto)             | —                                   |
| Pro (subido) | hasta 400 s | 140 s de pipeline (deja tiempo sin usar) | `EDGE_WALL_CLOCK_MS=400000` → 390 s |

```bash
npx supabase secrets set EDGE_WALL_CLOCK_MS=400000   # solo tras subirlo en el Dashboard
```

Fijarlo **por encima** del techo real es la configuración peligrosa: el pipeline presupuesta más de lo que la plataforma concede, el isolate muere de golpe sin ejecutar `catch`, `finally` ni el `setTimeout` de pipeline, y el job queda en `processing` para siempre. Ese fue exactamente el fallo de 2026-07-27 (ver `SPEC.md` §10.10). Valores fuera de `[60000, 400000]` o no numéricos caen al defecto de 150 s.

El token `analysis_worker_token` no se crea con `supabase secrets set`: la migración lo genera dentro de Postgres y lo conserva en Vault. No copiarlo a variables de entorno.

No hay otros secretos backend personalizados operativos. Cualquier secret remoto huérfano (ej. `USE_AGENTS_SDK`, eliminado del código el 2026-05-09) puede borrarse con `supabase secrets unset <NAME>` sin afectar runtime.

## 6.1. Tareas programadas en Postgres (`pg_cron`)

Tres trabajos, todos registrados por migración con `cron.schedule`, que hace upsert por nombre:

| Nombre                           | Frecuencia | Qué hace                                                                   |
| -------------------------------- | ---------- | -------------------------------------------------------------------------- |
| `analysis-worker-recovery-sweep` | cada 10 s  | Despierta al worker si hay pasos en cola, reintentando o con lease vencido |
| `analysis-resource-cleanup`      | cada hora  | Limpieza TTL de recursos OpenAI, Storage y filas de documentos             |
| `analysis-stale-step-reclaim`    | cada 5 min | Cierra trabajo abandonado que ningún consumidor puede retomar              |

El tercero se añadió el 2026-07-27 porque el barrido colgaba del inicio de `analyze-with-agents`, que Fase 1B dejó como ruta de rollback: sin ese cron dejó de ejecutarse (ver `SPEC.md` §10.13). Su frecuencia es baja a propósito — no desbloquea trabajo en curso, solo cierra el ya muerto.

Se ejecutan como `postgres` con `SECURITY INVOKER`, así que dependen de grants reales y no de superusuario. Para inspeccionarlos: `select jobname, schedule, active from cron.job;`.

La migración `20260727200000` vuelve a recrear `record_analysis_phase`; como en la anterior, sustituye la definición en vez de añadir una sobrecarga, porque PostgREST resuelve las RPC por nombre. Tras desplegar conviene confirmar que sigue habiendo **una sola** definición: `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'record_analysis_phase';`

## 7. Validación posterior al despliegue

Después del despliegue, QA debe comprobar al menos:

- que las cuatro funciones figuran en el listado de Supabase
- que no hay errores inmediatos de ejecución
- que el flujo principal sigue respondiendo como mínimo en un smoke test sobre un pliego representativo del camino principal (PDF completo)
- que en los logs de `analyze-with-agents` aparecen entradas con prefijo `[trace]` (al menos 1 por cada fase B y C) — verifica que el `SupabaseLogTraceProcessor` está activo
- que `analysis-jobs:init` devuelve job + plan firmado, `submit` devuelve 202 y los cuatro steps terminan `completed`
- que `analysis_steps` no conserva mensajes activos tras un análisis correcto y un fallo reintentable mantiene el mensaje sin archivarlo
- que Broadcast privado solo despierta una relectura RLS y polling completa el flujo si Realtime se desconecta
- que `analysis-jobs`, `analyze-with-agents` y `chat-with-analysis-agent` responden 401 sin JWT y `analysis-worker` responde 401 sin token M2M

Comandos útiles:

```bash
npx supabase functions list
npx supabase functions logs analysis-jobs --tail
npx supabase functions logs analysis-worker --tail
npx supabase functions logs analyze-with-agents --tail | grep '\[trace\]'
npx supabase functions logs chat-with-analysis-agent --tail
```

## 8. Rollback operativo

Si el despliegue introduce una regresión:

- la tarea debe volver a `## To Do` con `🐛 BUG:` y log asociado en `BACKLOG.md`
- se debe preparar una nueva tarea correctiva
- la documentación debe recoger el riesgo o incidencia si aplica
- si la regresión es del pipeline `analyze-with-agents` (Fase B o C) → `git revert` del PR responsable y abrir issue inmediatamente. Ya no existe el flag `USE_AGENTS_SDK` que permitía alternar entre el camino SDK y el legacy sin redeploy.
- si falla el worker/control plane de Fase 1B → revertir frontend a `analyze-with-agents`/SSE y el PR responsable; no borrar ledger, colas, Vault ni migraciones ya aplicadas. Los jobs existentes deben dejarse recuperables o marcarse terminales de forma explícita.
- si una función pública rechaza JWT legítimos → revertir el cambio responsable y diagnosticar gateway/config; no desactivar JWT como workaround silencioso
- si falla la auth M2M del worker → verificar Vault/digest y revertir el runtime; nunca eliminar `x-analysis-worker-token` ni exponer el token al cliente

## 9. Regla documental

Si cambia el proceso real de despliegue, este archivo debe actualizarse antes de cerrar la tarea correspondiente.

## 10. Disciplina de archivos en `scripts/`

Cualquier script bajo `scripts/` debe ser invocado desde `package.json`, `.github/workflows/` o `.husky/`. La verificación mínima:

- `verify-ci.sh` → invocado por `pnpm verify:release` (entry point del cierre obligatorio antes de push/PR).
- `verify-integrity.ts` → invocado por `pnpm verify:integrity` y por el job `Repo Integrity` del workflow.
- `evals/pliegos/run.ts` → invocado manualmente por `pnpm eval:pliegos:live`; el scoring determinista se ejecuta desde `verify-ci.sh`.
- `evals/pliegos/diff.ts` → invocado por `pnpm eval:pliegos:diff`; su contrato (`diff_test.ts`) corre en `verify-ci.sh` y en el job `Edge Function Checks`.

Si un script futuro deja de usarse desde alguno de esos sitios, debe eliminarse en lugar de mantenerse "por si acaso". El repo no conserva scripts de conveniencia muertos.

## Fábrica de agentes autónomos (Claude Code en GitHub Actions)

El repo ejecuta cuatro agentes autónomos con `anthropics/claude-code-action@v1`,
coordinados por `BACKLOG.md` y sin intervención humana. Cada rol tiene un
workflow en `.github/workflows/` (`agent-pm.yml`, `agent-tech.yml`,
`agent-ia.yml`, `agent-qa.yml`) y su prompt operativo en
`.claude/commands/agent-<rol>.md`.

**Cómo se invoca el prompt.** Cada workflow pasa `prompt: '/agent-<rol>'`: el
input `prompt` de la action acepta la invocación de un comando/skill del repo, y
`actions/checkout` ya ha traído `.claude/commands/` cuando corre el paso. No se
describe el fichero en prosa para que Claude lo abra — eso gastaba un turno y
dejaba las instrucciones como salida de herramienta en vez de como comando
cargado.

**Los cuatro comandos llevan `disable-model-invocation: true`.** Desde que los
custom commands se unificaron con las skills, un fichero en `.claude/commands/`
es invocable por el modelo, no solo por el usuario. Sin ese flag, Claude podía
cargar por su cuenta —en una sesión interactiva cualquiera— un prompt que dice
«nunca preguntes» y termina en `git push` + `gh pr merge --auto`. El flag no
impide la invocación explícita `/agent-<rol>`, que es justo la que usan estos
workflows.

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
no mutan) y `context7` (documentación versionada). El servidor de Supabase va
pineado a una versión concreta (no `@latest`), igual que el resto de herramientas
de CI, y sus variables llevan default (`${SUPABASE_PROJECT_REF:-...}`) para que
una sesión local sin exportarlas no arranque el servidor con un `${VAR}` literal.
El único camino de escritura a producción sigue siendo el deploy del pipeline
tras el merge.

### Configuración de Claude Code versionada (`.claude/`)

`.claude/` y `.mcp.json` **se versionan**: CI y las sesiones cloud clonan el repo,
así que lo que no esté commiteado no existe allí. El `.gitignore` solo excluye
`.claude/settings.local.json` (preferencias personales por máquina).

| Ruta                             | Qué es                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `.claude/settings.json`          | Hook `SessionStart` (`matcher: startup\|resume`) y `permissions.deny` sobre `.env*` |
| `.claude/hooks/session-start.sh` | Prepara el entorno de sesión: dependencias, `.env.local`, symlinks de Playwright    |
| `.claude/commands/agent-*.md`    | Prompts de la fábrica de agentes (`disable-model-invocation: true`)                 |
| `.claude/rules/*.md`             | Reglas con `paths:` que entran en contexto solo al tocar los ficheros que cubren    |
| `.claude/skills/observability/`  | Procedimiento de diagnóstico (Actions, logs Supabase, Vercel, spans `[trace]`)      |
| `.claude/skills/*` (symlinks)    | Skills de `.agents/skills/` expuestas donde Claude Code sí las lee                  |

Dos avisos que ya costaron un fallo silencioso y conviene no repetir:

- Un patrón de `.gitignore` sin barra inicial (`skills/`) captura el directorio a
  **cualquier** profundidad, incluido `.claude/skills/`. Anclar a raíz: `/skills/`.
- La lectura de secretos no se hace con `source .env.local`. `gh` y el MCP de
  GitHub se autentican solos; `permissions.deny` bloquea además leer `.env*`.

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
`licitaciones`. En un apply en frío (el _branching preview_ de Supabase, que
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
repair` (o el `delete` equivalente sobre `schema_migrations`).
