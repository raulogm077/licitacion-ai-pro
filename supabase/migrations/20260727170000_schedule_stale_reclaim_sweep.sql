-- Da a `reclaim_stale_analysis_steps` un disparador que de verdad ocurra.
--
-- Por qué
-- -------
-- El barrido se invoca de forma oportunista al inicio de cada request de
-- `analyze-with-agents`. Eso era razonable cuando esa función era el camino
-- principal de subida, pero Fase 1B la dejó como ruta de rollback SSE: el flujo
-- normal ahora entra por `analysis-jobs`. En la práctica el barrido se quedó
-- sin disparador y dejó de limpiar nada — verificado en producción tras el
-- despliegue de Fase 1B, con ~30 jobs no terminales y 0 en `dead_letter`.
--
-- Un `pg_cron` acotado resuelve el problema de raíz, además de cubrir el caso
-- que la invocación oportunista nunca podía cubrir: un usuario que no vuelve a
-- subir nada se queda con su análisis colgado indefinidamente en el historial.
--
-- Frecuencia
-- ----------
-- Cada 5 minutos, no cada 10 segundos como el sweep del worker. Este barrido no
-- desbloquea trabajo en curso, solo cierra trabajo ya muerto: la latencia no
-- importa, y un lease vencido lleva por definición al menos un lease completo
-- sin tocarse. `p_limit` acota cada pasada para que una acumulación histórica se
-- drene poco a poco en vez de en una transacción larga.
--
-- Sigue siendo seguro por construcción: la función no toca leases vigentes ni
-- jobs `async_worker`, cuya recuperación pertenece a `claim_next_analysis_step`.
--
-- Permisos
-- --------
-- `cron.schedule` ejecuta como el rol que la programa, aquí `postgres`, y la
-- función es `SECURITY INVOKER`. Comprobado contra producción que `postgres`
-- tiene EXECUTE sobre `reclaim_stale_analysis_steps` y sobre `pgmq.send`,
-- `pgmq.archive` y `pgmq.set_vt`, además de SELECT/UPDATE/DELETE en
-- `pgmq.q_analysis_steps` e INSERT en `pgmq.a_analysis_steps`. No depende de
-- superusuario: `postgres` no lo es en Supabase, son grants reales.

SELECT cron.schedule(
    'analysis-stale-step-reclaim',
    '*/5 * * * *',
    'SELECT public.reclaim_stale_analysis_steps(25)'
);
