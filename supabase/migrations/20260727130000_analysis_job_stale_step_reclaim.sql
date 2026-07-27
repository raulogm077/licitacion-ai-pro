-- Reclaims analysis work whose executor died without leaving a trace.
--
-- Why this is needed
-- ------------------
-- The transitional worker IS the HTTP request that started it. When the
-- Supabase platform kills the Edge Function isolate for exceeding its
-- wall-clock ceiling, the kill is abrupt: no catch block, no finally, and no
-- in-code timeout handler runs. The step therefore stays 'running' and the job
-- stays 'processing' forever.
--
-- `claim_analysis_step` only accepts steps in 'queued' or 'retrying', and
-- `fail_analysis_step` requires the caller to still own the lease. Neither can
-- touch a step abandoned in 'running', so an expired lease was terminal by
-- omission: the one failure mode the durable schema exists to survive was the
-- one it could not recover from.
--
-- This migration adds the missing transition. It is the only place allowed to
-- move a step out of 'running' without owning its lease, and it does so only
-- once the lease has actually expired.

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
    v_retryable boolean;
    v_error constant text :=
        'El análisis se interrumpió antes de terminar y no dejó resultado recuperable. '
        || 'Vuelve a lanzarlo; si el expediente es grande, súbelo con menos documentos o más ligeros.';
BEGIN
    -- 1. Steps abandoned mid-run: the lease expired, so the owner is gone.
    FOR v_row IN
        SELECT
            s.id,
            s.job_id AS jid,
            s.step_name AS sname,
            s.queue_message_id,
            s.attempt_count,
            s.max_attempts,
            j.execution_mode
        FROM public.analysis_job_steps s
        JOIN public.analysis_jobs j ON j.id = s.job_id
        WHERE s.status = 'running'
          AND s.lease_expires_at IS NOT NULL
          AND s.lease_expires_at < now()
        ORDER BY s.lease_expires_at
        LIMIT v_limit
        FOR UPDATE OF s SKIP LOCKED
    LOOP
        -- Re-queueing only helps if something other than the dead request can
        -- consume the queue. While execution_mode is 'inline_transition' the
        -- executor is the request itself, so a 'retrying' step would simply be
        -- a differently-shaped zombie: fail honestly instead. Once an async
        -- consumer exists, its jobs carry a different execution_mode and this
        -- branch starts returning them to the queue with no further change.
        v_retryable := v_row.execution_mode IS DISTINCT FROM 'inline_transition'
                       AND v_row.attempt_count < v_row.max_attempts;

        IF v_retryable THEN
            UPDATE public.analysis_job_steps
            SET
                status = 'retrying',
                lease_owner = NULL,
                lease_expires_at = NULL,
                next_attempt_at = now(),
                last_error = v_error
            WHERE id = v_row.id;

            IF v_row.queue_message_id IS NOT NULL THEN
                PERFORM pgmq.set_vt('analysis_steps', v_row.queue_message_id, 0);
            END IF;

            UPDATE public.analysis_jobs
            SET status = 'retrying', error = v_error
            WHERE id = v_row.jid;

            reclaimed_job_id := v_row.jid;
            reclaimed_step_name := v_row.sname;
            outcome := 'retrying';
        ELSE
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
        END IF;

        RETURN NEXT;
    END LOOP;

    -- 2. Jobs killed before any step took a lease (for example while the
    --    recoverable copy was still being written to Storage). They hold no
    --    lease to expire, so they need their own, deliberately conservative
    --    cutoff: no step is waiting on the queue and nothing has advanced for
    --    at least p_orphan_after_seconds.
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
    'Moves steps with an expired lease, and jobs orphaned before any step was leased, out of their non-terminal state. Backend-only: the browser never reclaims work.';

REVOKE ALL ON FUNCTION public.reclaim_stale_analysis_steps(integer, integer)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reclaim_stale_analysis_steps(integer, integer)
    TO service_role;

-- Supports both sweeps: the expired-lease scan and the orphan scan.
CREATE INDEX IF NOT EXISTS analysis_job_steps_stale_lease_idx
    ON public.analysis_job_steps (lease_expires_at)
    WHERE status = 'running';

CREATE INDEX IF NOT EXISTS analysis_jobs_non_terminal_idx
    ON public.analysis_jobs (started_at, created_at)
    WHERE status IN ('pending', 'processing', 'retrying');
