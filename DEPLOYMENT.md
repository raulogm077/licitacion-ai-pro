# Deployment actual

Este documento describe el proceso vigente de despliegue. No describe la arquitectura legacy de colas.

## 1. Qué se despliega

Superficies desplegables principales:

- frontend de la aplicación
- Edge Function `analyze-with-agents`
- Edge Function `chat-with-analysis-agent` para conversación sobre análisis persistidos

## 2. Quién puede desplegar

- **Solo QA** puede ejecutar despliegues de la Edge Function dentro del flujo nocturno.
- PM, Tech Lead y AI Engineer no despliegan.

## 3. Preconditions obligatorias

Antes de desplegar una tarea, QA debe verificar:

1. `pnpm typecheck`
2. `pnpm test`
3. `pnpm test:e2e` si la tarea toca UI, flujo de análisis o SSE
4. si la tarea es IA:
   - compatibilidad con la Guía de lectura de pliegos
   - compatibilidad con SSE
   - compatibilidad con schema/Zod
5. documentación mínima actualizada

## 4. Migraciones de base de datos

Antes de desplegar código que dependa de nuevas tablas o columnas, aplicar las migraciones pendientes:

```bash
npx supabase db push --include-all
```

Migraciones relevantes recientes:
- `20260329000000_fulltext_search.sql` — Columna `search_vector` (tsvector español), índice GIN, función RPC `search_licitaciones`
- `20260418002000_analysis_chat.sql` — tablas `analysis_chat_sessions` y `analysis_chat_messages` con RLS

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
- que el flujo principal sigue respondiendo como mínimo en un smoke test
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
