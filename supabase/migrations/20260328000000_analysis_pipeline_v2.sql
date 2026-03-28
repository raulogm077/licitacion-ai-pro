-- Migration: Analysis Pipeline V2
-- Extends analysis_jobs for phased pipeline and adds job documents table.

-- Extend analysis_jobs with pipeline fields
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS vector_store_id text;
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS file_ids text[] DEFAULT '{}';
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS phase text DEFAULT 'pending';
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS phase_results jsonb DEFAULT '{}';
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS document_map jsonb;
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS cleanup_at timestamptz;

-- Table: analysis_job_documents
CREATE TABLE IF NOT EXISTS analysis_job_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid REFERENCES analysis_jobs(id) ON DELETE CASCADE NOT NULL,
    file_name text NOT NULL,
    file_id text NOT NULL,
    document_type text,
    uploaded_at timestamptz DEFAULT now()
);

-- RLS for job documents
ALTER TABLE analysis_job_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own job documents"
    ON analysis_job_documents FOR SELECT
    USING (job_id IN (SELECT id FROM analysis_jobs WHERE user_id = auth.uid()));

CREATE POLICY "Users insert own job documents"
    ON analysis_job_documents FOR INSERT
    WITH CHECK (job_id IN (SELECT id FROM analysis_jobs WHERE user_id = auth.uid()));

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_cleanup
    ON analysis_jobs (cleanup_at)
    WHERE cleanup_at IS NOT NULL AND status IN ('completed', 'failed');

-- Index for phase tracking
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_phase
    ON analysis_jobs (user_id, phase, status);
