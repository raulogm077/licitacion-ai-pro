-- Follow-up from Supabase Preview advisors for the durable outbox.

CREATE INDEX IF NOT EXISTS idx_analysis_job_outbox_job_id
    ON public.analysis_job_outbox (job_id);

CREATE INDEX IF NOT EXISTS idx_analysis_job_outbox_step_id
    ON public.analysis_job_outbox (step_id);

-- Client access is intentionally denied. An explicit false policy documents
-- that intent and lets the security advisor distinguish it from forgotten RLS.
DROP POLICY IF EXISTS "Clients cannot access analysis job outbox"
    ON public.analysis_job_outbox;

CREATE POLICY "Clients cannot access analysis job outbox"
    ON public.analysis_job_outbox
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);
