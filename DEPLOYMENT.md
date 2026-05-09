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

> **Nota**: `db push` es no destructivo para migraciones nuevas, pero revisar siempre el plan antes de aplicar en producción.

## 5. Comando de despliegue de la Edge Function

```bash
npx supabase functions deploy analyze-with-agents
npx supabase functions deploy chat-with-analysis-agent
```

> **Ambas funciones usan `verify_jwt = true`** en `supabase/config.toml`. El gateway de Supabase rechaza con 401 las peticiones sin JWT válido antes de invocar el código de la función. Dentro de cada handler sólo se resuelve el `user` con `supabase.auth.getUser(token)` para rate-limiting (en `analyze-with-agents`) y ownership sobre `licitaciones` / `analysis_chat_sessions` (en `chat-with-analysis-agent`).
>
> Si en algún caso futuro hubiera que rebajar la postura para una función concreta, fijar `verify_jwt = false` en `[functions.<nombre>]` de `config.toml` y añadir `--no-verify-jwt` al comando — nunca con un solo cambio sin el otro.

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

## 5.3. Feature flag `USE_AGENTS_SDK` (rollback de Fase C)

La Fase C (extracción por bloques + plantilla personalizada) está migrada a `@openai/agents@0.3.1`. La implementación legacy basada en Responses API directa sigue presente en `supabase/functions/analyze-with-agents/phases/block-extraction.legacy.ts` y se reactiva con un secret de Supabase:

```bash
# Forzar el camino legacy sin redeploy
npx supabase secrets set USE_AGENTS_SDK=false

# Volver al camino SDK (default)
npx supabase secrets unset USE_AGENTS_SDK
```

El flag se elimina junto con `block-extraction.legacy.ts` cuando la paridad de salida vs `main` se confirma en producción.

## 6. Secretos y configuración

`OPENAI_API_KEY` debe estar configurada como secreto de Supabase para ambas Edge Functions. No debe exponerse en el frontend.

Ejemplo de configuración:

```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
```

Secretos opcionales:

- `USE_AGENTS_SDK=false` — desactiva temporalmente el camino `@openai/agents` en Fase C (ver §5.3).

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
- si la regresión es en Fase C → fijar `USE_AGENTS_SDK=false` (§5.3) como mitigación inmediata mientras se diagnostica
- si la regresión es de auth (peticiones legítimas rechazadas con 401) → cambiar `verify_jwt = false` en `[functions.<nombre>]` de `config.toml`, redesplegar con `--no-verify-jwt`, y abrir issue para diagnosticar antes de revertir

## 9. Regla documental

Si cambia el proceso real de despliegue, este archivo debe actualizarse antes de cerrar la tarea correspondiente.
