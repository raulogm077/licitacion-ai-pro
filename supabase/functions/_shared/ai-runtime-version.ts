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
    pipeline: 'five-phase-v1.0.0',
    // 1.1.0: los prompts de `economico` y `criteriosAdjudicacion` piden ahora
    // evidencia para los importes y las ponderaciones (Guía §6.3).
    prompts: 'pliegos-es-v1.1.0',
    // 1.2.0: PBL, VEC, importeIVA, ponderacion y umbralAnormalidad pasan a
    // TrackedField. La forma persistida cambia; el parseo sigue aceptando el
    // valor plano de los análisis anteriores.
    schema: 'canonical-v1.2.0',
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
