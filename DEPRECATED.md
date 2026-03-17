> Documento histórico.
> No usar como referencia operativa para agentes.
> La fuente vigente es:
> - README.md
> - ARCHITECTURE.md
> - SPEC.md
> - AGENTS.md
> - DEPLOYMENT.md

# Deprecated Components - Historial de Migración

**Fecha de referencia**: 2026-01-02  
**Migración principal**: OpenAI Assistants API + pgmq → OpenAI Agents SDK

## Propósito

Este archivo conserva trazabilidad de componentes retirados o migraciones antiguas. Sirve como memoria histórica, no como guía de implementación actual.

## Componentes retirados

### Migraciones antiguas

- `supabase/migrations/20260101000000_enable_pgmq.sql`
- `supabase/migrations/20260101000001_create_cron_jobs.sql`
- `supabase/migrations/20260101000002_create_storage_bucket.sql`

Motivo general: la arquitectura actual basada en streaming con Agents SDK no necesita cola `pgmq`, ni `pg_cron`, ni el flujo de polling previo.

### Edge Function antigua

- `supabase/functions/queue-processor/`

Motivo: reemplazada por `analyze-with-agents`.

## Compatibilidad legacy mantenida temporalmente

### `openai-runner`

- **Estado**: legado temporal
- **Uso histórico**: compatibilidad con flujo previo basado en polling
- **Destino esperado**: eliminación cuando deje de ser necesaria su compatibilidad

## Arquitectura antigua resumida

```text
User → Frontend → openai-runner
                   ↓
                pgmq queue
                   ↓
           queue-processor
                   ↓
             polling / jobs
                   ↓
               Frontend
```

## Arquitectura vigente resumida

```text
User → Frontend → analyze-with-agents
                   ↓
          OpenAI Files API / Vector Store
                   ↓
             Agents SDK (streaming)
                   ↓
                 SSE → Frontend
```

## Beneficios de la arquitectura vigente

- menos complejidad operativa
- feedback en tiempo real
- menos carga de base de datos
- menos piezas a mantener

## Regla de uso

Si algo aparece aquí y contradice `README.md`, `ARCHITECTURE.md` o `DEPLOYMENT.md`, prevalece siempre la documentación vigente.
