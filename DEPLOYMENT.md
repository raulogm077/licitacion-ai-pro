# Instrucciones de Despliegue

## 1. Aplicar Migraciones

```bash
# Verificar migraciones pendientes
npx supabase migration list

# Aplicar migraciones local (para testing)
npx supabase db reset

# Aplicar migraciones a producción
npx supabase db push
```

## 2. Configurar Variables de Entorno en Supabase

Ve al Dashboard de Supabase → SQL Editor y ejecuta:

```sql
-- Reemplaza con tu PROJECT REF y SERVICE ROLE KEY
ALTER DATABASE postgres SET app.settings.project_url = 'https://aehlrgvuqmzbzqufxayq.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE';
```

## 3. Desplegar Edge Functions

```bash
# Desplegar queue-processor
npx supabase functions deploy queue-processor

# Verificar deployment
npx supabase functions list
```

## 4. Verificar pg_cron Jobs

En SQL Editor:

```sql
-- Ver cron jobs activos
select jobid, jobname, schedule, active 
from cron.job 
where jobname in ('process-analysis-queue', 'sync-openai-runs');

-- Ver logs de ejecución reciente
select jobid, runid, job_pid, status, return_message, start_time 
from cron.job_run_details 
where jobid in (
    select jobid from cron.job 
    where jobname in ('process-analysis-queue', 'sync-openai-runs')
)
order by start_time desc 
limit 20;
```

## 5. Verificar Queue

```sql
-- Ver mensajes en cola
select * from pgmq_public.analysis_queue;

-- Ver mensajes archivados
select * from pgmq_public.analysis_queue_archive
order by archived_at desc
limit 10;
```

## 6. Test Manual

```bash
# Test desde local
npx tsx scripts/test-enqueue.ts
```

O desde Supabase Dashboard → Functions → queue-processor → Test:

```json
{
  "action": "process"
}
```

## 7. Monitoreo

### Ver logs de Edge Functions
- Dashboard → Functions → queue-processor → Logs
- Dashboard → Functions → openai-runner → Logs

### Ver estado de jobs
```sql
select 
    id,
    status,
    metadata->>'step' as step,
    metadata->>'message' as message,
    created_at,
    updated_at
from analysis_jobs
order by created_at desc
limit 10;
```

## Troubleshooting

### Si pg_cron no ejecuta:
```sql
-- Verificar que pg_cron está habilitado
select * from pg_extension where extname = 'pg_cron';

-- Reactivar job
select cron.unschedule('process-analysis-queue');
select cron.schedule(...); -- Ejecutar schedule de nuevo
```

### Si queue no funciona:
```sql
-- Verificar permisos
\dp pgmq_public.*

-- Recrear queue si es necesario
select pgmq.drop_queue('analysis_queue');
select pgmq.create('analysis_queue');
```
