-- Migration: Remove gemini provider and set default to openai

-- First, drop the constraint
ALTER TABLE public.licitaciones
DROP CONSTRAINT licitaciones_provider_check;

-- Second, set the new default
ALTER TABLE public.licitaciones
ALTER COLUMN provider SET DEFAULT 'openai';

-- Update any existing 'gemini' rows to 'openai' (though user stated no clients use the app)
UPDATE public.licitaciones
SET provider = 'openai'
WHERE provider = 'gemini';

-- Finally, re-add the constraint with only 'openai' allowed
ALTER TABLE public.licitaciones
ADD CONSTRAINT licitaciones_provider_check
    CHECK (provider IN ('openai'));

COMMENT ON COLUMN public.licitaciones.provider IS 'AI provider used for analysis: openai';
