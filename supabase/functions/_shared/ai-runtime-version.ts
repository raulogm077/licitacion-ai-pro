import { BLOCK_MODEL_OVERRIDES, OPENAI_MODEL } from './config.ts';

/**
 * Versiones semánticas del runtime de análisis.
 *
 * Reglas de incremento:
 * - pipeline: cambia la orquestación, el número de fases o su contrato.
 * - prompts: cambia cualquier instrucción que pueda alterar la extracción.
 * - schema: cambia la forma canónica persistida o sus reglas de validación.
 *
 * El evaluador live añade además un fingerprint SHA-256 de los ficheros reales,
 * de modo que un cambio olvidado en estas etiquetas sigue siendo detectable.
 */
export const ANALYSIS_RUNTIME_VERSIONS = Object.freeze({
    // 1.1.0: la Fase C puede emitir una re-consulta dirigida cuando un bloque
    // vuelve vacío pese a que el mapa documental prometía su contenido.
    pipeline: 'five-phase-v1.1.0',
    // 1.1.0: los prompts de `economico` y `criteriosAdjudicacion` piden ahora
    // evidencia para los importes y las ponderaciones (Guía §6.3).
    // 1.2.0: sufijo de búsqueda dirigida en la re-consulta de bloque vacío.
    prompts: 'pliegos-es-v1.2.0',
    // 1.2.0: PBL, VEC, importeIVA, ponderacion y umbralAnormalidad pasan a
    // TrackedField. La forma persistida cambia; el parseo sigue aceptando el
    // valor plano de los análisis anteriores.
    // 1.3.0: `section_diagnostics.code` admite `retrieval_failed` y
    // `partial_reasons` admite `extraction_incomplete`.
    schema: 'canonical-v1.3.0',
    model: OPENAI_MODEL,
    // Provenance por bloque. Mientras `BLOCK_MODEL_OVERRIDES` esté vacío la
    // clave no aparece, así que la forma persistida hoy no cambia; en cuanto
    // alguien abarate un bloque, `model` por sí solo mentiría sobre qué modelo
    // extrajo qué, y ese es justo el dato que hace falta para comparar una
    // regresión contra la baseline de `pnpm eval:pliegos:live`.
    ...(Object.keys(BLOCK_MODEL_OVERRIDES).length > 0
        ? { blockModels: { ...BLOCK_MODEL_OVERRIDES } as Record<string, string> }
        : {}),
    agentsSdk: '0.3.1',
});

export type AnalysisRuntimeVersions = typeof ANALYSIS_RUNTIME_VERSIONS;
