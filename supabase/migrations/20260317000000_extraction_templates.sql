-- Create extraction_templates table
CREATE TABLE IF NOT EXISTS public.extraction_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    schema JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS
ALTER TABLE public.extraction_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own templates"
    ON public.extraction_templates
    FOR ALL
    USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_extraction_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_extraction_templates_updated_at
BEFORE UPDATE ON public.extraction_templates
FOR EACH ROW
EXECUTE FUNCTION update_extraction_templates_updated_at();

-- Add template_id to licitaciones (optional relationship)
ALTER TABLE public.licitaciones
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.extraction_templates(id) ON DELETE SET NULL;
