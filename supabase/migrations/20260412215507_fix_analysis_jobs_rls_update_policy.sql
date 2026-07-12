-- Migration: Fix missing UPDATE and DELETE RLS policies on analysis_jobs
-- The edge function's updatePhase/completeJob/failJob calls were silently
-- blocked because only INSERT and SELECT policies existed. Jobs were stuck
-- at status=processing/phase=ingestion permanently.
--
-- NOTE (2026-07-12): PostgreSQL has no `CREATE POLICY IF NOT EXISTS`; that
-- syntax errored on a cold apply (Supabase branching preview). Replaced with
-- the idempotent `DROP POLICY IF EXISTS` + `CREATE POLICY` pattern. This file's
-- version is already recorded in production's schema_migrations, so `db push`
-- skips it there; the fix only affects fresh applies.

-- Allow users to update their own jobs (needed for phase tracking, completion, failure)
DROP POLICY IF EXISTS "Users can update their own jobs" ON analysis_jobs;
CREATE POLICY "Users can update their own jobs"
    ON analysis_jobs FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own jobs
DROP POLICY IF EXISTS "Users can delete their own jobs" ON analysis_jobs;
CREATE POLICY "Users can delete their own jobs"
    ON analysis_jobs FOR DELETE
    USING (auth.uid() = user_id);
