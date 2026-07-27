-- Restringe el barrido de leases expirados a los jobs que nadie más puede
-- recuperar, ahora que Fase 1B aporta un consumidor de cola de verdad.
--
-- Por qué
-- -------
-- `reclaim_stale_analysis_steps` (migración 20260727130000) se escribió cuando el
-- worker era el propio request HTTP: un paso abandonado en `running` no tenía
-- quien lo retomara, así que el barrido lo reencolaba o lo mataba.
--
-- Fase 1B cambia eso para los jobs `async_worker`. `claim_next_analysis_step`
-- acepta explícitamente un paso `running` con lease vencido y lo reanuda **desde
-- su checkpoint**, y `private.recover_analysis_worker()` despierta al worker con
-- esa misma condición desde `pg_cron`. Ese camino es estrictamente mejor que
-- reencolar: conserva los bloques ya extraídos.
--
-- Mantener los dos activos dejaría dos escritores sobre el mismo estado. El
-- barrido oportunista podría marcar `retrying` —y escribir un `error` visible en
-- la fila del job— sobre un análisis que en realidad se está recuperando solo.
-- Así que el barrido cede ese terreno y se queda con lo que sigue sin dueño:
--
--   * jobs `inline_transition` (la ruta de rollback SSE de `analyze-with-agents`),
--     donde el ejecutor es la petición y no hay consumidor posible;
--   * jobs huérfanos sin ningún paso en `running`/`queued`/`retrying`, que son
--     invisibles para `recover_analysis_worker` porque no tienen nada en cola.
--
-- La rama de reencolado desaparece por lo mismo: el único modo que este barrido
-- atiende ya es el que jamás puede reintentarse.

CREATE OR REPLACE FUNCTION public.reclaim_stale_analysis_steps(
    p_limit integer DEFAULT 10,
    p_orphan_after_seconds integer DEFAULT 3600
)
RETURNS TABLE (
    reclaimed_job_id uuid,
    reclaimed_step_name text,
    outcome text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_row record;
    v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 10), 100));
    v_orphan_after integer := GREATEST(300, LEAST(COALESCE(p_orphan_after_seconds, 3600), 86400));
    v_error constant text :=
        'El análisis se interrumpió antes de terminar y no dejó resultado recuperable. '
        || 'Vuelve a lanzarlo; si el expediente es grande, súbelo con menos documentos o más ligeros.';
BEGIN
    -- 1. Pasos abandonados de la ruta inline. Un `execution_mode` asíncrono se
    --    deja intacto a propósito: su consumidor lo reanuda desde el checkpoint.
    FOR v_row IN
        SELECT
            s.id,
            s.job_id AS jid,
            s.step_name AS sname,
            s.queue_message_id,
            s.attempt_count
        FROM public.analysis_job_steps s
        JOIN public.analysis_jobs j ON j.id = s.job_id
        WHERE s.status = 'running'
          AND s.lease_expires_at IS NOT NULL
          AND s.lease_expires_at < now()
          AND j.execution_mode = 'inline_transition'
        ORDER BY s.lease_expires_at
        LIMIT v_limit
        FOR UPDATE OF s SKIP LOCKED
    LOOP
        UPDATE public.analysis_job_steps
        SET
            status = 'dead_letter',
            lease_owner = NULL,
            lease_expires_at = NULL,
            next_attempt_at = NULL,
            completed_at = now(),
            last_error = v_error
        WHERE id = v_row.id;

        PERFORM pgmq.send(
            'analysis_steps_dead_letter',
            jsonb_build_object(
                'schema_version', 1,
                'job_id', v_row.jid,
                'step_id', v_row.id,
                'step_name', v_row.sname,
                'attempt_count', v_row.attempt_count,
                'error', v_error,
                'failed_at', now(),
                'reason', 'lease_expired'
            )
        );

        IF v_row.queue_message_id IS NOT NULL THEN
            PERFORM pgmq.archive('analysis_steps', v_row.queue_message_id);
        END IF;

        UPDATE public.analysis_jobs
        SET
            status = 'dead_letter',
            phase = 'failed',
            error = v_error,
            completed_at = now()
        WHERE id = v_row.jid;

        reclaimed_job_id := v_row.jid;
        reclaimed_step_name := v_row.sname;
        outcome := 'dead_letter';

        RETURN NEXT;
    END LOOP;

    -- 2. Jobs muertos antes de que ningún paso tomara lease. No tienen nada en
    --    cola, así que `recover_analysis_worker` no los ve en ningún modo.
    FOR v_row IN
        SELECT j.id AS jid
        FROM public.analysis_jobs j
        WHERE j.status IN ('pending', 'processing', 'retrying')
          AND COALESCE(j.started_at, j.created_at) < now() - make_interval(secs => v_orphan_after)
          AND NOT EXISTS (
              SELECT 1
              FROM public.analysis_job_steps s
              WHERE s.job_id = j.id
                AND s.status IN ('running', 'queued', 'retrying')
          )
        ORDER BY COALESCE(j.started_at, j.created_at)
        LIMIT v_limit
        FOR UPDATE OF j SKIP LOCKED
    LOOP
        UPDATE public.analysis_jobs
        SET
            status = 'dead_letter',
            phase = 'failed',
            error = v_error,
            completed_at = now()
        WHERE id = v_row.jid;

        reclaimed_job_id := v_row.jid;
        reclaimed_step_name := NULL;
        outcome := 'orphaned';

        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.reclaim_stale_analysis_steps(integer, integer) IS
    'Cierra el trabajo abandonado que ningún consumidor puede retomar: pasos inline con lease vencido y jobs huérfanos sin nada en cola. Los jobs async_worker los recupera claim_next_analysis_step desde su checkpoint. Backend-only.';
