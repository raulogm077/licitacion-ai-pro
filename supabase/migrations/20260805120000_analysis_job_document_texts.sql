-- ADR-003 Fase 2 — el texto del documento en nuestro lado.
--
-- El pipeline nunca veía el contenido de los PDFs: los subía a OpenAI y
-- preguntaba. Sin texto propio no hay nada contra lo que falsar una
-- `evidence.quote`, y de ahí salieron seis análisis de los mismos dos ficheros
-- con seis licitaciones distintas, cada una con su cita de apoyo.
--
-- Tabla aparte y no columnas en `analysis_job_documents`, por dos razones:
--
--   1. `analysis_job_documents` se lee en CADA slice del worker. Un `text` de
--      cientos de KB ahí convierte cualquier `select('*')` futuro en megabytes
--      por slice. Separarlo lo hace imposible por construcción.
--   2. El texto es un oráculo de backend. El navegador no lo necesita para nada
--      y una columna nueva heredaría el `SELECT` de usuario de la tabla padre.
--      Aquí la postura se elige: RLS activo y **sin políticas**, de modo que
--      solo `service_role` llega.

CREATE TABLE IF NOT EXISTS public.analysis_job_document_texts (
    document_id uuid PRIMARY KEY REFERENCES public.analysis_job_documents(id) ON DELETE CASCADE,
    job_id uuid NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
    status text NOT NULL,
    content text NOT NULL DEFAULT '',
    char_count integer NOT NULL DEFAULT 0,
    page_count integer,
    reason text,
    extracted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_job_document_texts
    DROP CONSTRAINT IF EXISTS analysis_job_document_texts_status_check,
    ADD CONSTRAINT analysis_job_document_texts_status_check CHECK (
        status IN ('extracted', 'truncated', 'empty', 'unsupported', 'failed')
    ),
    DROP CONSTRAINT IF EXISTS analysis_job_document_texts_char_count_check,
    ADD CONSTRAINT analysis_job_document_texts_char_count_check CHECK (char_count >= 0),
    DROP CONSTRAINT IF EXISTS analysis_job_document_texts_page_count_check,
    ADD CONSTRAINT analysis_job_document_texts_page_count_check CHECK (page_count IS NULL OR page_count >= 0);

CREATE INDEX IF NOT EXISTS idx_analysis_job_document_texts_job
    ON public.analysis_job_document_texts (job_id);

-- RLS activo y sin política alguna: nadie salvo `service_role` (que la evita
-- por definición) lee esta tabla. Añadir aquí un `SELECT` para `authenticated`
-- expondría el texto completo del expediente al navegador sin que ninguna
-- pantalla lo necesite.
ALTER TABLE public.analysis_job_document_texts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.analysis_job_document_texts FROM anon, authenticated;
GRANT ALL ON TABLE public.analysis_job_document_texts TO service_role;

COMMENT ON TABLE public.analysis_job_document_texts IS
    'Texto extraído localmente de cada documento. Oráculo de verificación de citas (ADR-003). Backend-only: RLS activo sin políticas.';
COMMENT ON COLUMN public.analysis_job_document_texts.status IS
    'extracted = texto completo (único estado que permite declarar una cita fabricada); truncated/empty/unsupported/failed = no concluyente.';
