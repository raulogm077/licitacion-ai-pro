-- Migration: Fix missing UPDATE and DELETE RLS policies on analysis_jobs
-- The edge function's updatePhase/completeJob/failJob calls were silently
-- blocked because only INSERT and SELECT policies existed. Jobs were stuck
-- at status=processing/phase=ingestion permanently.

-- Allow users to update their own jobs (needed for phase tracking, completion, failure)
CREATE POLICY IF NOT EXISTS "Users can update their own jobs"
    ON analysis_jobs FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own jobs
CREATE POLICY IF NOT EXISTS "Users can delete their own jobs"
    ON analysis_jobs FOR DELETE
    USING (auth.uid() = user_id);
