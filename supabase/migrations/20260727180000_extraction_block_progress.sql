-- Expone el avance por bloque de la extracción al navegador.
--
-- Por qué
-- -------
-- La extracción es el tramo largo del pipeline: el worker la trocea en slices y
-- puede ocupar varios minutos. El navegador no tenía forma de saber cuántos
-- bloques llevaba, así que la barra se quedaba clavada en el punto medio del
-- rango de la fase mientras el análisis avanzaba de verdad.
--
-- El dato ya existía: cada checkpoint persiste el `BlockExtractionResult`
-- completo en `phase_results.extraction.blocks`. Lo que faltaba era exponerlo de
-- forma barata. Ese JSON contiene los datos y las evidencias de cada bloque —
-- cientos de KB— y el navegador lo sondea cada 2 s, así que leerlo entero sería
-- desproporcionado para mostrar «4 de 9».
--
-- De ahí una columna `progress` compacta: `{"done": 4, "total": 9}`. El worker
-- la escribe en el mismo checkpoint que ya hacía, y el trigger de Broadcast la
-- incluye para que Realtime y polling vean lo mismo.

ALTER TABLE public.analysis_jobs
    ADD COLUMN IF NOT EXISTS progress jsonb;

COMMENT ON COLUMN public.analysis_jobs.progress IS
    'Avance compacto de la fase en curso ({"done","total"}), pensado para sondeo frecuente. El detalle vive en phase_results.';

-- Se recrea con un parámetro nuevo por defecto en vez de añadir una sobrecarga:
-- PostgREST resuelve las RPC por nombre y una sobrecarga sería ambigua. Los
-- llamantes que pasan 4 argumentos siguen siendo válidos.
DROP FUNCTION IF EXISTS public.record_analysis_phase(uuid, text, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.record_analysis_phase(
    p_job_id uuid,
    p_phase text,
    p_phase_result jsonb,
    p_document_map jsonb,
    p_progress jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    UPDATE public.analysis_jobs
    SET
        phase = p_phase,
        status = 'processing',
        phase_results = CASE
            WHEN p_phase_result IS NULL THEN COALESCE(phase_results, '{}'::jsonb)
            ELSE COALESCE(phase_results, '{}'::jsonb) || jsonb_build_object(p_phase, p_phase_result)
        END,
        document_map = COALESCE(p_document_map, document_map),
        -- Se conserva el valor anterior si la llamada no trae progreso, para que
        -- una fase sin granularidad no borre el último avance conocido.
        progress = COALESCE(p_progress, progress),
        updated_at = now()
    WHERE id = p_job_id;
$$;

REVOKE ALL ON FUNCTION public.record_analysis_phase(uuid, text, jsonb, jsonb, jsonb)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_analysis_phase(uuid, text, jsonb, jsonb, jsonb)
    TO service_role;

-- El trigger solo disparaba en status/phase/result/error, así que un checkpoint
-- de bloque no despertaba a nadie. Añadir `progress` a la lista es lo que hace
-- que el avance intra-fase llegue por Realtime.
CREATE OR REPLACE FUNCTION private.broadcast_analysis_job_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM realtime.send(
        jsonb_build_object(
            'jobId', NEW.id,
            'status', NEW.status,
            'phase', NEW.phase,
            'progress', NEW.progress,
            'updatedAt', NEW.updated_at,
            'completedAt', NEW.completed_at
        ),
        'analysis_job_updated',
        'analysis-job:' || NEW.id::text,
        true
    );
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.broadcast_analysis_job_state() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS broadcast_analysis_job_state ON public.analysis_jobs;
CREATE TRIGGER broadcast_analysis_job_state
    AFTER UPDATE OF status, phase, progress, result, error ON public.analysis_jobs
    FOR EACH ROW
    EXECUTE FUNCTION private.broadcast_analysis_job_state();
