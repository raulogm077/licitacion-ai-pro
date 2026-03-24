-- Tabla para almacenar feedback de extracción de usuario
CREATE TABLE IF NOT EXISTS public.extraction_feedback (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  licitacion_hash text NOT NULL,
  field_path text NOT NULL,
  value text NOT NULL,
  feedback_type text NOT NULL CHECK (feedback_type IN ('up', 'down')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT extraction_feedback_unique UNIQUE (user_id, licitacion_hash, field_path)
);

-- RLS
ALTER TABLE public.extraction_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON public.extraction_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback"
  ON public.extraction_feedback FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own feedback"
  ON public.extraction_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feedback"
  ON public.extraction_feedback FOR DELETE
  USING (auth.uid() = user_id);

-- Index para consultas frecuentes
CREATE INDEX idx_feedback_user_hash ON public.extraction_feedback (user_id, licitacion_hash);
