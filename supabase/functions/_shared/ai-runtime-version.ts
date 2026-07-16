import { OPENAI_MODEL } from './config.ts';

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
    prompts: 'pliegos-es-v1.0.0',
    schema: 'canonical-v1.1.0',
    model: OPENAI_MODEL,
    agentsSdk: '0.3.1',
});

export type AnalysisRuntimeVersions = typeof ANALYSIS_RUNTIME_VERSIONS;
