-- Durable analysis jobs foundation (Fase 1)
--
-- Guarantees introduced here:
--   1. A job exists before any Storage or OpenAI side effect.
--   2. Each pipeline step has a durable ledger, lease and retry budget.
--   3. Inserting an outbox row and publishing its PGMQ message are one
--      PostgreSQL transaction.
--   4. Queue operations are backend-only; authenticated users can only read
--      their own job state through RLS.

CREATE EXTENSION IF NOT EXISTS pgmq;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pgmq.meta WHERE queue_name = 'analysis_steps') THEN
        PERFORM pgmq.create('analysis_steps');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pgmq.meta WHERE queue_name = 'analysis_steps_dead_letter') THEN
        PERFORM pgmq.create('analysis_steps_dead_letter');
    END IF;
END;
$$;

-- Job-level idempotency, runtime provenance and lifecycle timestamps.
ALTER TABLE public.analysis_jobs
    ADD COLUMN IF NOT EXISTS idempotency_key text,
    ADD COLUMN IF NOT EXISTS input_fingerprint text,
    ADD COLUMN IF NOT EXISTS runtime_version jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'inline_transition',
    ADD COLUMN IF NOT EXISTS started_at timestamptz,
    ADD COLUMN IF NOT EXISTS completed_at timestamptz,
    ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz,
    ADD COLUMN IF NOT EXISTS retention_until timestamptz;

ALTER TABLE public.analysis_jobs
    DROP CONSTRAINT IF EXISTS analysis_jobs_status_check;

ALTER TABLE public.analysis_jobs
    ADD CONSTRAINT analysis_jobs_status_check CHECK (
        status IN (
            'pending',
            'queued',
            'processing',
            'retrying',
            'completed',
            'failed',
            'cancelled',
            'dead_letter'
        )
    ),
    DROP CONSTRAINT IF EXISTS analysis_jobs_idempotency_key_length_check,
    ADD CONSTRAINT analysis_jobs_idempotency_key_length_check CHECK (
        idempotency_key IS NULL OR length(idempotency_key) BETWEEN 8 AND 200
    ),
    DROP CONSTRAINT IF EXISTS analysis_jobs_input_fingerprint_check,
    ADD CONSTRAINT analysis_jobs_input_fingerprint_check CHECK (
        input_fingerprint IS NULL OR input_fingerprint ~ '^[0-9a-f]{64}$'
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_analysis_jobs_user_idempotency
    ON public.analysis_jobs (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status_created
    ON public.analysis_jobs (status, created_at);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_retention
    ON public.analysis_jobs (retention_until)
    WHERE retention_until IS NOT NULL;

-- A document can now be recorded from its recoverable Storage copy before an
-- OpenAI file id exists.
ALTER TABLE public.analysis_job_documents
    ALTER COLUMN file_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS storage_path text,
    ADD COLUMN IF NOT EXISTS content_sha256 text,
    ADD COLUMN IF NOT EXISTS size_bytes bigint,
    ADD COLUMN IF NOT EXISTS mime_type text,
    ADD COLUMN IF NOT EXISTS retention_until timestamptz;

ALTER TABLE public.analysis_job_documents
    DROP CONSTRAINT IF EXISTS analysis_job_documents_source_check,
    ADD CONSTRAINT analysis_job_documents_source_check CHECK (
        file_id IS NOT NULL OR storage_path IS NOT NULL
    ),
    DROP CONSTRAINT IF EXISTS analysis_job_documents_sha256_check,
    ADD CONSTRAINT analysis_job_documents_sha256_check CHECK (
        content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'
    ),
    DROP CONSTRAINT IF EXISTS analysis_job_documents_size_check,
    ADD CONSTRAINT analysis_job_documents_size_check CHECK (
        size_bytes IS NULL OR size_bytes >= 0
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_analysis_job_documents_storage_path
    ON public.analysis_job_documents (job_id, storage_path)
    WHERE storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_job_documents_retention
    ON public.analysis_job_documents (retention_until)
    WHERE retention_until IS NOT NULL;

-- The request accepts PDF, DOCX and TXT documents up to an aggregate 50 MB.
-- Keep the private recovery bucket aligned with that public contract.
UPDATE storage.buckets
SET
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ]::text[]
WHERE id = 'analysis-pdfs';

CREATE TABLE IF NOT EXISTS public.analysis_job_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
    step_name text NOT NULL,
    step_order integer NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (
        status IN (
            'pending',
            'queued',
            'running',
            'retrying',
            'completed',
            'failed',
            'cancelled',
            'dead_letter'
        )
    ),
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
    lease_owner text,
    lease_expires_at timestamptz,
    next_attempt_at timestamptz,
    queue_message_id bigint,
    input_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
    output_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
    last_error text,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, step_name),
    UNIQUE (job_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_analysis_job_steps_claimable
    ON public.analysis_job_steps (status, next_attempt_at, created_at)
    WHERE status IN ('queued', 'retrying');

CREATE INDEX IF NOT EXISTS idx_analysis_job_steps_job_order
    ON public.analysis_job_steps (job_id, step_order);

ALTER TABLE public.analysis_job_steps ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_analysis_job_steps_updated_at ON public.analysis_job_steps;
CREATE TRIGGER update_analysis_job_steps_updated_at
    BEFORE UPDATE ON public.analysis_job_steps
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.analysis_job_outbox (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id uuid NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
    step_id uuid NOT NULL REFERENCES public.analysis_job_steps(id) ON DELETE CASCADE,
    event_type text NOT NULL DEFAULT 'analysis.step.ready',
    payload jsonb NOT NULL,
    idempotency_key text NOT NULL UNIQUE,
    publish_attempts integer NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0),
    published_at timestamptz,
    queue_message_id bigint,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_job_outbox_unpublished
    ON public.analysis_job_outbox (created_at)
    WHERE published_at IS NULL;

ALTER TABLE public.analysis_job_outbox ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER is intentionally isolated in the non-exposed private
-- schema. It only bridges the transactional outbox to the non-exposed queue.
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
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.publish_analysis_job_outbox() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS publish_analysis_job_outbox ON public.analysis_job_outbox;
CREATE TRIGGER publish_analysis_job_outbox
    BEFORE INSERT ON public.analysis_job_outbox
    FOR EACH ROW
    EXECUTE FUNCTION private.publish_analysis_job_outbox();

-- Creates the job and its complete step ledger before external side effects.
-- Reusing an idempotency key returns the original job; a different body hash
-- under the same key is rejected.
CREATE OR REPLACE FUNCTION public.create_analysis_job(
    p_user_id uuid,
    p_filename text,
    p_idempotency_key text,
    p_input_fingerprint text,
    p_runtime_version jsonb,
    p_retention_until timestamptz,
    p_metadata jsonb
)
RETURNS TABLE (job_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_job_id uuid;
    v_existing_fingerprint text;
    v_created boolean := false;
BEGIN
    INSERT INTO public.analysis_jobs (
        user_id,
        status,
        phase,
        metadata,
        cleanup_at,
        retention_until,
        idempotency_key,
        input_fingerprint,
        runtime_version,
        execution_mode
    )
    VALUES (
        p_user_id,
        'pending',
        'pending',
        COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('filename', p_filename),
        p_retention_until,
        p_retention_until,
        p_idempotency_key,
        p_input_fingerprint,
        COALESCE(p_runtime_version, '{}'::jsonb),
        'inline_transition'
    )
    ON CONFLICT (user_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL
        DO NOTHING
    RETURNING id INTO v_job_id;

    IF v_job_id IS NOT NULL THEN
        v_created := true;

        INSERT INTO public.analysis_job_steps (job_id, step_name, step_order)
        VALUES
            (v_job_id, 'ingestion_map', 10),
            (v_job_id, 'extraction', 20),
            (v_job_id, 'consolidation', 30),
            (v_job_id, 'validation', 40);
    ELSE
        SELECT id, input_fingerprint
        INTO v_job_id, v_existing_fingerprint
        FROM public.analysis_jobs
        WHERE user_id = p_user_id
          AND idempotency_key = p_idempotency_key;

        IF v_job_id IS NULL THEN
            RAISE EXCEPTION 'Unable to resolve idempotent analysis job';
        END IF;

        IF v_existing_fingerprint IS DISTINCT FROM p_input_fingerprint THEN
            RAISE EXCEPTION 'Idempotency key already belongs to a different analysis input'
                USING ERRCODE = '23505';
        END IF;
    END IF;

    RETURN QUERY SELECT v_job_id, v_created;
END;
$$;

-- Enqueue is idempotent per step dispatch. The outbox trigger publishes the
-- message before this transaction commits, then the message id is copied onto
-- the step ledger.
CREATE OR REPLACE FUNCTION public.enqueue_analysis_step(
    p_job_id uuid,
    p_step_name text,
    p_payload jsonb
)
RETURNS TABLE (step_id uuid, queue_message_id bigint)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_step public.analysis_job_steps%ROWTYPE;
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

    IF v_step.status IN ('queued', 'running', 'retrying', 'completed') THEN
        RETURN QUERY SELECT v_step.id, v_step.queue_message_id;
        RETURN;
    END IF;

    IF v_step.status NOT IN ('pending', 'failed') THEN
        RAISE EXCEPTION 'Step % cannot be enqueued from status %', p_step_name, v_step.status;
    END IF;

    v_payload := COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object(
        'schema_version', 1,
        'job_id', p_job_id,
        'step_id', v_step.id,
        'step_name', p_step_name
    );

    INSERT INTO public.analysis_job_outbox (
        job_id,
        step_id,
        payload,
        idempotency_key
    )
    VALUES (
        p_job_id,
        v_step.id,
        v_payload,
        p_job_id::text || ':' || p_step_name || ':dispatch:' || v_step.attempt_count::text
    )
    RETURNING analysis_job_outbox.queue_message_id INTO v_message_id;

    UPDATE public.analysis_job_steps
    SET
        status = 'queued',
        input_ref = v_payload,
        queue_message_id = v_message_id,
        next_attempt_at = now(),
        last_error = NULL
    WHERE id = v_step.id;

    UPDATE public.analysis_jobs
    SET status = 'queued', phase = p_step_name, error = NULL
    WHERE id = p_job_id AND status <> 'completed';

    RETURN QUERY SELECT v_step.id, v_message_id;
END;
$$;

-- Claims a visible step and extends the queue message visibility to match the
-- database lease. A future worker can safely use the same RPC.
CREATE OR REPLACE FUNCTION public.claim_analysis_step(
    p_job_id uuid,
    p_step_name text,
    p_worker_id text,
    p_lease_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_step public.analysis_job_steps%ROWTYPE;
    v_lease_seconds integer := GREATEST(30, LEAST(COALESCE(p_lease_seconds, 300), 3600));
BEGIN
    SELECT *
    INTO v_step
    FROM public.analysis_job_steps
    WHERE job_id = p_job_id AND step_name = p_step_name
    FOR UPDATE;

    IF NOT FOUND OR v_step.status NOT IN ('queued', 'retrying') THEN
        RETURN false;
    END IF;

    IF v_step.next_attempt_at IS NOT NULL AND v_step.next_attempt_at > now() THEN
        RETURN false;
    END IF;

    IF v_step.queue_message_id IS NULL THEN
        RAISE EXCEPTION 'Step % has no queue message', p_step_name;
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
    WHERE id = v_step.id;

    PERFORM pgmq.set_vt('analysis_steps', v_step.queue_message_id, v_lease_seconds);

    UPDATE public.analysis_jobs
    SET
        status = 'processing',
        phase = p_step_name,
        started_at = COALESCE(started_at, now()),
        error = NULL
    WHERE id = p_job_id;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_analysis_step(
    p_job_id uuid,
    p_step_name text,
    p_worker_id text,
    p_output_ref jsonb
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

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF v_step.status = 'completed' THEN
        RETURN true;
    END IF;

    IF v_step.status <> 'running' OR v_step.lease_owner IS DISTINCT FROM p_worker_id THEN
        RETURN false;
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

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_analysis_step(
    p_job_id uuid,
    p_step_name text,
    p_worker_id text,
    p_error text,
    p_retry_delay_seconds integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_step public.analysis_job_steps%ROWTYPE;
    v_retry_delay integer := GREATEST(5, LEAST(COALESCE(p_retry_delay_seconds, 60), 3600));
    v_next_status text;
BEGIN
    SELECT *
    INTO v_step
    FROM public.analysis_job_steps
    WHERE job_id = p_job_id AND step_name = p_step_name
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown step % for analysis job %', p_step_name, p_job_id;
    END IF;

    IF v_step.status IN ('completed', 'dead_letter', 'cancelled') THEN
        RETURN v_step.status;
    END IF;

    IF v_step.status <> 'running' OR v_step.lease_owner IS DISTINCT FROM p_worker_id THEN
        RETURN v_step.status;
    END IF;

    IF v_step.attempt_count < v_step.max_attempts THEN
        v_next_status := 'retrying';

        UPDATE public.analysis_job_steps
        SET
            status = v_next_status,
            lease_owner = NULL,
            lease_expires_at = NULL,
            next_attempt_at = now() + make_interval(secs => v_retry_delay),
            last_error = left(p_error, 8000)
        WHERE id = v_step.id;

        IF v_step.queue_message_id IS NOT NULL THEN
            PERFORM pgmq.set_vt('analysis_steps', v_step.queue_message_id, v_retry_delay);
        END IF;

        UPDATE public.analysis_jobs
        SET status = 'retrying', error = left(p_error, 8000)
        WHERE id = p_job_id;
    ELSE
        v_next_status := 'dead_letter';

        UPDATE public.analysis_job_steps
        SET
            status = v_next_status,
            lease_owner = NULL,
            lease_expires_at = NULL,
            next_attempt_at = NULL,
            completed_at = now(),
            last_error = left(p_error, 8000)
        WHERE id = v_step.id;

        PERFORM pgmq.send(
            'analysis_steps_dead_letter',
            jsonb_build_object(
                'schema_version', 1,
                'job_id', p_job_id,
                'step_id', v_step.id,
                'step_name', p_step_name,
                'attempt_count', v_step.attempt_count,
                'error', left(p_error, 8000),
                'failed_at', now()
            )
        );

        IF v_step.queue_message_id IS NOT NULL THEN
            PERFORM pgmq.archive('analysis_steps', v_step.queue_message_id);
        END IF;

        UPDATE public.analysis_jobs
        SET status = 'dead_letter', phase = 'failed', error = left(p_error, 8000), completed_at = now()
        WHERE id = p_job_id;
    END IF;

    RETURN v_next_status;
END;
$$;

-- Atomically merges phase diagnostics; this replaces the previous
-- read-modify-write sequence that could lose concurrent updates.
CREATE OR REPLACE FUNCTION public.record_analysis_phase(
    p_job_id uuid,
    p_phase text,
    p_phase_result jsonb,
    p_document_map jsonb
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    UPDATE public.analysis_jobs
    SET
        phase = p_phase,
        status = 'processing',
        phase_results = CASE
            WHEN p_phase_result IS NULL THEN COALESCE(phase_results, '{}'::jsonb)
            ELSE COALESCE(phase_results, '{}'::jsonb) || jsonb_build_object(p_phase, p_phase_result)
        END,
        document_map = COALESCE(p_document_map, document_map),
        updated_at = now()
    WHERE id = p_job_id;
$$;

-- Cross-tenant writes are backend-only. Browser clients retain read access to
-- their own jobs, documents and step state for polling/recovery.
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.analysis_jobs;
DROP POLICY IF EXISTS "Users can create their own jobs" ON public.analysis_jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON public.analysis_jobs;
DROP POLICY IF EXISTS "Users can delete their own jobs" ON public.analysis_jobs;

CREATE POLICY "Users can view their own jobs"
    ON public.analysis_jobs FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users see own job documents" ON public.analysis_job_documents;
DROP POLICY IF EXISTS "Users insert own job documents" ON public.analysis_job_documents;

CREATE POLICY "Users see own job documents"
    ON public.analysis_job_documents FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.analysis_jobs
            WHERE analysis_jobs.id = analysis_job_documents.job_id
              AND analysis_jobs.user_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users see own job steps" ON public.analysis_job_steps;
CREATE POLICY "Users see own job steps"
    ON public.analysis_job_steps FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.analysis_jobs
            WHERE analysis_jobs.id = analysis_job_steps.job_id
              AND analysis_jobs.user_id = (SELECT auth.uid())
        )
    );

REVOKE ALL ON TABLE public.analysis_jobs FROM anon, authenticated;
REVOKE ALL ON TABLE public.analysis_job_documents FROM anon, authenticated;
REVOKE ALL ON TABLE public.analysis_job_steps FROM anon, authenticated;
REVOKE ALL ON TABLE public.analysis_job_outbox FROM anon, authenticated;

GRANT SELECT ON TABLE public.analysis_jobs TO authenticated;
GRANT SELECT ON TABLE public.analysis_job_documents TO authenticated;
GRANT SELECT ON TABLE public.analysis_job_steps TO authenticated;

GRANT ALL ON TABLE public.analysis_jobs TO service_role;
GRANT ALL ON TABLE public.analysis_job_documents TO service_role;
GRANT ALL ON TABLE public.analysis_job_steps TO service_role;
GRANT ALL ON TABLE public.analysis_job_outbox TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.analysis_job_outbox_id_seq TO service_role;

REVOKE ALL ON FUNCTION public.create_analysis_job(uuid, text, text, text, jsonb, timestamptz, jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_analysis_step(uuid, text, jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_analysis_step(uuid, text, text, integer)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_analysis_step(uuid, text, text, jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_analysis_step(uuid, text, text, text, integer)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_analysis_phase(uuid, text, jsonb, jsonb)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_analysis_job(uuid, text, text, text, jsonb, timestamptz, jsonb)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_analysis_step(uuid, text, jsonb)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_analysis_step(uuid, text, text, integer)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_analysis_step(uuid, text, text, jsonb)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_analysis_step(uuid, text, text, text, integer)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.record_analysis_phase(uuid, text, jsonb, jsonb)
    TO service_role;
