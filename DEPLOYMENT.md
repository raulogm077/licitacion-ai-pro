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
npx supabase functions deploy analyze-with-agents --no-verify-jwt
npx supabase functions deploy chat-with-analysis-agent --no-verify-jwt
```

> **Nota sobre `--no-verify-jwt`**: Este flag desactiva la validación JWT del Kong API Gateway de Supabase. La función valida el JWT internamente usando el SDK de Supabase (`supabase.auth.getUser()`), lo que permite un manejo granular de errores de autenticación y evita problemas de CORS con preflight requests.

### 5.1. Validación de `chat-with-analysis-agent`

Antes de desplegar la función conversacional:

```bash
deno check --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/index.ts
deno test --allow-env --node-modules-dir=auto supabase/functions/chat-with-analysis-agent/tools_test.ts
```

Después del despliegue remoto:

```bash
npx supabase functions deploy chat-with-analysis-agent --no-verify-jwt
```

## 6. Secretos y configuración

`OPENAI_API_KEY` debe estar configurada como secreto de Supabase para la Edge Function. No debe exponerse en el frontend.

Ejemplo de configuración:

```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
```

## 7. Validación posterior al despliegue

Después del despliegue, QA debe comprobar al menos:

- que la función figura en el listado de Supabase
- que no hay errores inmediatos de ejecución
- que el flujo principal sigue respondiendo como mínimo en un smoke test sobre un pliego representativo del camino principal (PDF completo)
- si se ha desplegado `chat-with-analysis-agent`, que responde al menos con `401` sin JWT y no afecta al flujo batch existente

Comandos útiles:

```bash
npx supabase functions list
```

## 8. Rollback operativo

Si el despliegue introduce una regresión:

- la tarea debe volver a `## To Do` con `🐛 BUG:` y log asociado en `BACKLOG.md`
- se debe preparar una nueva tarea correctiva
- la documentación debe recoger el riesgo o incidencia si aplica

## 9. Regla documental

Si cambia el proceso real de despliegue, este archivo debe actualizarse antes de cerrar la tarea correspondiente.
