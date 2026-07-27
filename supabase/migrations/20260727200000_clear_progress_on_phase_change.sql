-- Limpia `progress` al cambiar de fase.
--
-- Por qué
-- -------
-- `record_analysis_phase` conserva el progreso anterior cuando la llamada no
-- trae uno (`COALESCE(p_progress, progress)`), que es lo correcto mientras se
-- sigue dentro de la misma fase: el worker hace checkpoints que no siempre
-- aportan contador y no deben borrar el último avance conocido.
--
-- Pero al pasar a consolidación o validación ese valor deja de significar nada
-- y se queda pegado a la fila para siempre — un job completado conservaba
-- `{"done":9,"total":9}` indefinidamente. Hoy es inocuo porque el navegador
-- solo lo lee durante la extracción, pero es estado muerto que invita a que el
-- próximo consumidor lo lea sin ese contexto y muestre un avance falso.
--
-- La condición compara la fase entrante con la almacenada: dentro de un UPDATE,
-- una referencia a `phase` en la parte derecha del SET es el valor **anterior**,
-- así que `p_phase IS DISTINCT FROM phase` detecta exactamente la transición.

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
        progress = CASE
            WHEN p_progress IS NOT NULL THEN p_progress
            WHEN p_phase IS DISTINCT FROM phase THEN NULL
            ELSE progress
        END,
        updated_at = now()
    WHERE id = p_job_id;
$$;

REVOKE ALL ON FUNCTION public.record_analysis_phase(uuid, text, jsonb, jsonb, jsonb)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_analysis_phase(uuid, text, jsonb, jsonb, jsonb)
    TO service_role;
