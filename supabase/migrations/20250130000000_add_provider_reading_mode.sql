-- Add provider and reading_mode columns to licitaciones table
-- Migration: Track AI provider and reading mode for each analysis

ALTER TABLE public.licitaciones
ADD COLUMN provider text NOT NULL DEFAULT 'gemini',
ADD COLUMN reading_mode text NOT NULL DEFAULT 'full';

-- Add indexes for filtering/analytics
CREATE INDEX licitaciones_provider_idx ON public.licitaciones (provider);
CREATE INDEX licitaciones_reading_mode_idx ON public.licitaciones (reading_mode);

-- Add check constraints for valid values
ALTER TABLE public.licitaciones
ADD CONSTRAINT licitaciones_provider_check 
    CHECK (provider IN ('gemini', 'openai'));

ALTER TABLE public.licitaciones
ADD CONSTRAINT licitaciones_reading_mode_check 
    CHECK (reading_mode IN ('full', 'keydata'));

COMMENT ON COLUMN public.licitaciones.provider IS 'AI provider used for analysis: gemini or openai';
COMMENT ON COLUMN public.licitaciones.reading_mode IS 'Reading mode: full (complete analysis) or keydata (key data only)';
