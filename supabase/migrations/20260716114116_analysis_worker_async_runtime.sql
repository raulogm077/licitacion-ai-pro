-- Fase 1B: signed uploads, independent queue consumer and Realtime recovery.
--
-- The worker activation path is deliberately self-contained:
--   * a random bearer token is generated inside Postgres and stored in Vault;
--   * only its SHA-256 digest is exposed to the service-role Edge runtime;
--   * pg_net triggers a worker after enqueue and pg_cron provides a 10-second
--     recovery sweep if an HTTP activation is lost.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.analysis_runtime_settings (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    worker_url text CHECK (worker_url IS NULL OR worker_url ~ '^https://[^/]+/functions/v1/analysis-worker$'),
    worker_token_sha256 text NOT NULL CHECK (worker_token_sha256 ~ '^[0-9a-f]{64}$'),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_runtime_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients cannot access analysis runtime settings"
    ON public.analysis_runtime_settings;
CREATE POLICY "Clients cannot access analysis runtime settings"
    ON public.analysis_runtime_settings
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

REVOKE ALL ON TABLE public.analysis_runtime_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.analysis_runtime_settings TO service_role;

DO $$
DECLARE
    v_worker_token text;
BEGIN
    SELECT decrypted_secret
    INTO v_worker_token
    FROM vault.decrypted_secrets
    WHERE name = 'analysis_worker_token';

    IF v_worker_token IS NULL THEN
        v_worker_token := encode(extensions.gen_random_bytes(32), 'hex');
        PERFORM vault.create_secret(
            v_worker_token,
            'analysis_worker_token',
            'Internal token for the analysis-worker Edge Function'
        );
    END IF;

    INSERT INTO public.analysis_runtime_settings (singleton, worker_token_sha256)
    VALUES (
        true,
        encode(extensions.digest(convert_to(v_worker_token, 'UTF8'), 'sha256'), 'hex')
    )
    ON CONFLICT (singleton) DO UPDATE
    SET
        worker_token_sha256 = EXCLUDED.worker_token_sha256,
        updated_at = now();
END;
$$;

ALTER TABLE public.analysis_job_documents
    ADD COLUMN IF NOT EXISTS upload_status text NOT NULL DEFAULT 'verified',
    ADD COLUMN IF NOT EXISTS verified_at timestamptz,
    ADD COLUMN IF NOT EXISTS document_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.analysis_job_documents
    DROP CONSTRAINT IF EXISTS analysis_job_documents_upload_status_check,
    ADD CONSTRAINT analysis_job_documents_upload_status_check CHECK (
        upload_status IN ('pending', 'uploaded', 'verified', 'failed')
    ),
    DROP CONSTRAINT IF EXISTS analysis_job_documents_order_check,
    ADD CONSTRAINT analysis_job_documents_order_check CHECK (document_order >= 0);

CREATE INDEX IF NOT EXISTS idx_analysis_job_documents_pending_upload
    ON public.analysis_job_documents (job_id, uploaded_at)
    WHERE upload_status IN ('pending', 'uploaded');

-- OpenAI resources and their per-document links form one checkpoint. Keeping
-- this in a single transaction prevents a retry from observing a vector store
-- whose file links were only partially persisted.
CREATE OR REPLACE FUNCTION public.record_analysis_external_resources(
    p_job_id uuid,
    p_vector_store_id text,
    p_file_ids text[],
    p_document_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_document_count integer := COALESCE(cardinality(p_document_ids), 0);
    v_file_count integer := COALESCE(cardinality(p_file_ids), 0);
    v_updated_count integer;
BEGIN
    IF p_vector_store_id IS NULL OR btrim(p_vector_store_id) = '' THEN
        RAISE EXCEPTION 'vector store id is required';
    END IF;
    IF v_document_count = 0 OR v_document_count <> v_file_count THEN
        RAISE EXCEPTION 'document ids and file ids must have the same non-zero length';
    END IF;

    PERFORM 1
    FROM public.analysis_jobs
    WHERE id = p_job_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown analysis job %', p_job_id;
    END IF;

    UPDATE public.analysis_jobs
    SET
        vector_store_id = p_vector_store_id,
        file_ids = p_file_ids,
        updated_at = now()
    WHERE id = p_job_id;

    WITH resources AS (
        SELECT resource.document_id, resource.file_id
        FROM unnest(p_document_ids, p_file_ids) AS resource(document_id, file_id)
    )
    UPDATE public.analysis_job_documents AS document
    SET file_id = resources.file_id
    FROM resources
    WHERE document.id = resources.document_id
      AND document.job_id = p_job_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count <> v_document_count THEN
        RAISE EXCEPTION 'Not all analysis documents belong to job %', p_job_id;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_analysis_external_resources(uuid, text, text[], uuid[])
    TO service_role;
REVOKE ALL ON FUNCTION public.record_analysis_external_resources(uuid, text, text[], uuid[])
    FROM PUBLIC, anon, authenticated;

-- Invoked only by the private outbox trigger and pg_cron. pg_net persists the
-- HTTP request after the transaction commits, so enqueue never waits on Edge.
CREATE OR REPLACE FUNCTION private.invoke_analysis_worker(p_mode text DEFAULT 'work')
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_worker_url text;
    v_worker_token text;
    v_request_id bigint;
BEGIN
    IF p_mode NOT IN ('work', 'cleanup') THEN
        RAISE EXCEPTION 'Unsupported analysis worker mode';
    END IF;

    SELECT worker_url
    INTO v_worker_url
    FROM public.analysis_runtime_settings
    WHERE singleton = true;

    IF v_worker_url IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT decrypted_secret
    INTO v_worker_token
    FROM vault.decrypted_secrets
    WHERE name = 'analysis_worker_token';

    IF v_worker_token IS NULL THEN
        RAISE EXCEPTION 'analysis_worker_token is missing from Vault';
    END IF;

    SELECT net.http_post(
        url := v_worker_url,
        body := jsonb_build_object('mode', p_mode),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-analysis-worker-token', v_worker_token
        ),
        timeout_milliseconds := 5000
    )
    INTO v_request_id;

    RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION private.invoke_analysis_worker(text) FROM PUBLIC, anon, authenticated;

-- Cron is only a recovery net. Avoid a paid/noisy Edge invocation when no
-- ledger row is actually claimable; normal work is activated immediately by
-- the transactional outbox trigger below.
CREATE OR REPLACE FUNCTION private.recover_analysis_worker()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.analysis_job_steps AS step
        JOIN public.analysis_jobs AS job ON job.id = step.job_id
        WHERE job.status NOT IN ('completed', 'failed', 'cancelled', 'dead_letter')
          AND (
              (step.status IN ('queued', 'retrying') AND COALESCE(step.next_attempt_at, now()) <= now())
              OR (step.status = 'running' AND step.lease_expires_at <= now())
          )
    ) THEN
        RETURN private.invoke_analysis_worker();
    END IF;

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.recover_analysis_worker() FROM PUBLIC, anon, authenticated;

-- Replaces the Fase 1A bridge with the same transactional publication plus a
-- best-effort immediate worker activation. The queue remains the source of
-- truth if pg_net is temporarily unavailable.
CREATE OR REPLACE FUNCTION private.publish_analysis_job_outbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_message_id bigint;
BEGIN
    SELECT sent.message_id
    INTO v_message_id
    FROM pgmq.send('analysis_steps', NEW.payload) AS sent(message_id);

    IF v_message_id IS NULL THEN
        RAISE EXCEPTION 'PGMQ did not return a message id for outbox row %', NEW.id;
    END IF;

    NEW.queue_message_id := v_message_id;
    NEW.published_at := now();
    NEW.publish_attempts := COALESCE(NEW.publish_attempts, 0) + 1;
    NEW.last_error := NULL;

    PERFORM private.invoke_analysis_worker();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.publish_analysis_job_outbox() FROM PUBLIC, anon, authenticated;

-- Claims the next visible PGMQ message and its ledger row in one transaction.
-- Stale messages are archived; expired leases are safely reclaimed.
CREATE OR REPLACE FUNCTION public.claim_next_analysis_step(
    p_worker_id text,
    p_lease_seconds integer DEFAULT 360
)
RETURNS TABLE (
    claimed_job_id uuid,
    claimed_step_name text,
    claimed_payload jsonb,
    claimed_attempt_count integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_message pgmq.message_record;
    v_step public.analysis_job_steps%ROWTYPE;
    v_job public.analysis_jobs%ROWTYPE;
    v_step_id uuid;
    v_lease_seconds integer := GREATEST(30, LEAST(COALESCE(p_lease_seconds, 360), 3600));
    v_delay integer;
BEGIN
    FOR v_message IN
        SELECT *
        FROM pgmq.read('analysis_steps', v_lease_seconds, 5, '{}'::jsonb)
    LOOP
        BEGIN
            v_step_id := (v_message.message ->> 'step_id')::uuid;
        EXCEPTION WHEN OTHERS THEN
            PERFORM pgmq.archive('analysis_steps', v_message.msg_id);
            CONTINUE;
        END;

        SELECT *
        INTO v_step
        FROM public.analysis_job_steps
        WHERE id = v_step_id
        FOR UPDATE;

        IF NOT FOUND OR v_step.queue_message_id IS DISTINCT FROM v_message.msg_id THEN
            PERFORM pgmq.archive('analysis_steps', v_message.msg_id);
            CONTINUE;
        END IF;

        SELECT *
        INTO v_job
        FROM public.analysis_jobs
        WHERE id = v_step.job_id
        FOR UPDATE;

        IF NOT FOUND OR v_job.status IN ('completed', 'failed', 'cancelled', 'dead_letter') THEN
            PERFORM pgmq.archive('analysis_steps', v_message.msg_id);
            CONTINUE;
        END IF;

        IF v_job.cancel_requested_at IS NOT NULL THEN
            UPDATE public.analysis_job_steps
            SET status = 'cancelled', completed_at = now(), lease_owner = NULL, lease_expires_at = NULL
            WHERE id = v_step.id;
            UPDATE public.analysis_jobs
            SET status = 'cancelled', phase = 'cancelled', completed_at = now()
            WHERE id = v_job.id;
            PERFORM pgmq.archive('analysis_steps', v_message.msg_id);
            CONTINUE;
        END IF;

        IF v_step.status = 'completed' THEN
            PERFORM pgmq.archive('analysis_steps', v_message.msg_id);
            CONTINUE;
        END IF;

        IF v_step.status = 'running' AND v_step.lease_expires_at > now() THEN
            v_delay := GREATEST(5, CEIL(EXTRACT(EPOCH FROM (v_step.lease_expires_at - now())))::integer);
            PERFORM pgmq.set_vt('analysis_steps', v_message.msg_id, v_delay);
            CONTINUE;
        END IF;

        IF v_step.status = 'retrying' AND v_step.next_attempt_at > now() THEN
            v_delay := GREATEST(5, CEIL(EXTRACT(EPOCH FROM (v_step.next_attempt_at - now())))::integer);
            PERFORM pgmq.set_vt('analysis_steps', v_message.msg_id, v_delay);
            CONTINUE;
        END IF;

        IF v_step.status NOT IN ('queued', 'retrying', 'running') THEN
            PERFORM pgmq.archive('analysis_steps', v_message.msg_id);
            CONTINUE;
        END IF;

        IF v_step.attempt_count >= v_step.max_attempts THEN
            UPDATE public.analysis_job_steps
            SET
                status = 'dead_letter',
                completed_at = now(),
                lease_owner = NULL,
                lease_expires_at = NULL,
                last_error = COALESCE(last_error, 'Worker lease expired after the final attempt')
            WHERE id = v_step.id;

            PERFORM pgmq.send(
                'analysis_steps_dead_letter',
                jsonb_build_object(
                    'schema_version', 1,
                    'job_id', v_step.job_id,
                    'step_id', v_step.id,
                    'step_name', v_step.step_name,
                    'attempt_count', v_step.attempt_count,
                    'error', COALESCE(v_step.last_error, 'Worker lease expired after the final attempt'),
                    'failed_at', now()
                )
            );
            PERFORM pgmq.archive('analysis_steps', v_message.msg_id);
            UPDATE public.analysis_jobs
            SET
                status = 'dead_letter',
                phase = 'failed',
                error = COALESCE(v_step.last_error, 'Worker lease expired after the final attempt'),
                completed_at = now()
            WHERE id = v_step.job_id;
            CONTINUE;
        END IF;

        UPDATE public.analysis_job_steps
        SET
            status = 'running',
            attempt_count = attempt_count + 1,
            lease_owner = p_worker_id,
            lease_expires_at = now() + make_interval(secs => v_lease_seconds),
            started_at = COALESCE(started_at, now()),
            next_attempt_at = NULL,
            last_error = NULL
        WHERE id = v_step.id
        RETURNING * INTO v_step;

        UPDATE public.analysis_jobs
        SET
            status = 'processing',
            phase = v_step.step_name,
            started_at = COALESCE(started_at, now()),
            error = NULL
        WHERE id = v_step.job_id;

        RETURN QUERY SELECT v_step.job_id, v_step.step_name, v_message.message, v_step.attempt_count;
        RETURN;
    END LOOP;
END;
$$;

-- Checkpoint + ack + dispatch-next is atomic. If the worker dies after this
-- commit, either the job is terminal or the next queue message already exists.
CREATE OR REPLACE FUNCTION public.advance_analysis_step(
    p_job_id uuid,
    p_step_name text,
    p_worker_id text,
    p_output_ref jsonb,
    p_next_payload jsonb DEFAULT '{}'::jsonb,
    p_final_result jsonb DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_step public.analysis_job_steps%ROWTYPE;
    v_next public.analysis_job_steps%ROWTYPE;
    v_message_id bigint;
    v_payload jsonb;
BEGIN
    SELECT *
    INTO v_step
    FROM public.analysis_job_steps
    WHERE job_id = p_job_id AND step_name = p_step_name
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown step % for analysis job %', p_step_name, p_job_id;
    END IF;

    IF v_step.status = 'completed' THEN
        RETURN 'already_completed';
    END IF;

    IF v_step.status <> 'running' OR v_step.lease_owner IS DISTINCT FROM p_worker_id THEN
        RETURN 'lost_lease';
    END IF;

    UPDATE public.analysis_job_steps
    SET
        status = 'completed',
        output_ref = COALESCE(p_output_ref, '{}'::jsonb),
        lease_owner = NULL,
        lease_expires_at = NULL,
        completed_at = now(),
        last_error = NULL
    WHERE id = v_step.id;

    IF v_step.queue_message_id IS NOT NULL THEN
        PERFORM pgmq.archive('analysis_steps', v_step.queue_message_id);
    END IF;

    IF p_final_result IS NOT NULL THEN
        UPDATE public.analysis_jobs
        SET
            status = 'completed',
            phase = 'completed',
            result = p_final_result,
            completed_at = now(),
            updated_at = now(),
            error = NULL
        WHERE id = p_job_id;
        RETURN 'completed';
    END IF;

    SELECT *
    INTO v_next
    FROM public.analysis_job_steps
    WHERE job_id = p_job_id
      AND step_order > v_step.step_order
      AND status = 'pending'
    ORDER BY step_order
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 'no_next_step';
    END IF;

    v_payload := COALESCE(p_next_payload, '{}'::jsonb) || jsonb_build_object(
        'schema_version', 1,
        'job_id', p_job_id,
        'step_id', v_next.id,
        'step_name', v_next.step_name
    );

    INSERT INTO public.analysis_job_outbox (job_id, step_id, payload, idempotency_key)
    VALUES (
        p_job_id,
        v_next.id,
        v_payload,
        p_job_id::text || ':' || v_next.step_name || ':dispatch:' || v_next.attempt_count::text
    )
    RETURNING queue_message_id INTO v_message_id;

    UPDATE public.analysis_job_steps
    SET
        status = 'queued',
        input_ref = v_payload,
        queue_message_id = v_message_id,
        next_attempt_at = now(),
        last_error = NULL
    WHERE id = v_next.id;

    UPDATE public.analysis_jobs
    SET status = 'queued', phase = v_next.step_name, error = NULL, updated_at = now()
    WHERE id = p_job_id;

    RETURN v_next.step_name;
END;
$$;

-- Releases a successful partial slice without consuming retry budget. The
-- same PGMQ message becomes visible again and the cron recovery sweep starts
-- the next bounded slice. A real crash does not call this function, so its
-- incremented attempt remains counted toward DLQ.
CREATE OR REPLACE FUNCTION public.yield_analysis_step(
    p_job_id uuid,
    p_step_name text,
    p_worker_id text,
    p_output_ref jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_step public.analysis_job_steps%ROWTYPE;
BEGIN
    SELECT *
    INTO v_step
    FROM public.analysis_job_steps
    WHERE job_id = p_job_id AND step_name = p_step_name
    FOR UPDATE;

    IF NOT FOUND
       OR v_step.status <> 'running'
       OR v_step.lease_owner IS DISTINCT FROM p_worker_id
    THEN
        RETURN false;
    END IF;

    UPDATE public.analysis_job_steps
    SET
        status = 'queued',
        attempt_count = GREATEST(attempt_count - 1, 0),
        output_ref = COALESCE(output_ref, '{}'::jsonb) || COALESCE(p_output_ref, '{}'::jsonb),
        lease_owner = NULL,
        lease_expires_at = NULL,
        next_attempt_at = now() + interval '1 second',
        last_error = NULL
    WHERE id = v_step.id;

    IF v_step.queue_message_id IS NULL THEN
        RAISE EXCEPTION 'Step % has no queue message to yield', p_step_name;
    END IF;
    PERFORM pgmq.set_vt('analysis_steps', v_step.queue_message_id, 1);

    UPDATE public.analysis_jobs
    SET status = 'queued', phase = p_step_name, error = NULL, updated_at = now()
    WHERE id = p_job_id;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION pgmq.read(text, integer, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_next_analysis_step(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_analysis_step(uuid, text, text, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.yield_analysis_step(uuid, text, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.claim_next_analysis_step(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_analysis_step(uuid, text, text, jsonb, jsonb, jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.yield_analysis_step(uuid, text, text, jsonb)
    FROM PUBLIC, anon, authenticated;

-- Lightweight private Broadcast notification. The final JSON result is not
-- copied into Realtime; the browser receives a state hint and re-reads the row
-- through the existing tenant-scoped SELECT policy.
CREATE OR REPLACE FUNCTION private.broadcast_analysis_job_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM realtime.send(
        jsonb_build_object(
            'jobId', NEW.id,
            'status', NEW.status,
            'phase', NEW.phase,
            'updatedAt', NEW.updated_at,
            'completedAt', NEW.completed_at
        ),
        'analysis_job_updated',
        'analysis-job:' || NEW.id::text,
        true
    );
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.broadcast_analysis_job_state() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS broadcast_analysis_job_state ON public.analysis_jobs;
CREATE TRIGGER broadcast_analysis_job_state
    AFTER UPDATE OF status, phase, result, error ON public.analysis_jobs
    FOR EACH ROW
    EXECUTE FUNCTION private.broadcast_analysis_job_state();

DROP POLICY IF EXISTS "Users receive own analysis job broadcasts" ON realtime.messages;
CREATE POLICY "Users receive own analysis job broadcasts"
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
        realtime.messages.extension = 'broadcast'
        AND CASE
            WHEN (SELECT realtime.topic()) ~ '^analysis-job:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            THEN EXISTS (
                SELECT 1
                FROM public.analysis_jobs
                WHERE analysis_jobs.id = split_part((SELECT realtime.topic()), ':', 2)::uuid
                  AND analysis_jobs.user_id = (SELECT auth.uid())
            )
            ELSE false
        END
    );

-- cron.schedule upserts by job name. The function is a no-op until the first
-- analysis-jobs request records the environment-specific worker URL.
SELECT cron.schedule(
    'analysis-worker-recovery-sweep',
    '10 seconds',
    'SELECT private.recover_analysis_worker()'
);

-- One bounded activation per hour guarantees TTL cleanup even during periods
-- without new analyses. The worker removes OpenAI resources first, then the
-- private Storage copies and document rows.
SELECT cron.schedule(
    'analysis-resource-cleanup',
    '5 * * * *',
    'SELECT private.invoke_analysis_worker(''cleanup'')'
);
