-- Add provider and reading_mode columns to licitaciones table
-- Migration: Track AI provider and reading mode for each analysis
--
-- NOTE (2026-07-12): renamed from 20250130000000_ to 20251229000000_ so it
-- sorts AFTER 20251228000000_initial_schema (which creates the table). The
-- previous out-of-order timestamp made a cold apply (Supabase branching
-- preview) fail with `relation "public.licitaciones" does not exist`.
-- Made idempotent so re-applying (db push against an existing DB where the
-- columns already exist) is a safe no-op.

ALTER TABLE public.licitaciones
    ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'gemini';
ALTER TABLE public.licitaciones
    ADD COLUMN IF NOT EXISTS reading_mode text NOT NULL DEFAULT 'full';

-- Add indexes for filtering/analytics
CREATE INDEX IF NOT EXISTS licitaciones_provider_idx ON public.licitaciones (provider);
CREATE INDEX IF NOT EXISTS licitaciones_reading_mode_idx ON public.licitaciones (reading_mode);

-- Add check constraints for valid values (guarded: ADD CONSTRAINT has no IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'licitaciones_provider_check') THEN
        ALTER TABLE public.licitaciones
            ADD CONSTRAINT licitaciones_provider_check CHECK (provider IN ('gemini', 'openai'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'licitaciones_reading_mode_check') THEN
        ALTER TABLE public.licitaciones
            ADD CONSTRAINT licitaciones_reading_mode_check CHECK (reading_mode IN ('full', 'keydata'));
    END IF;
END $$;

COMMENT ON COLUMN public.licitaciones.provider IS 'AI provider used for analysis: gemini or openai';
COMMENT ON COLUMN public.licitaciones.reading_mode IS 'Reading mode: full (complete analysis) or keydata (key data only)';
