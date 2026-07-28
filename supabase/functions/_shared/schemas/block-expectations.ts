/**
 * Expectativas de extracción por bloque.
 *
 * El pipeline hace dos lecturas independientes del mismo corpus: la Fase B
 * construye el mapa documental y marca por documento qué contiene
 * (`contieneCriterios`, `contienePresupuesto`, …), y la Fase C extrae cada
 * bloque con `file_search`. Hasta ahora la primera solo servía de contexto para
 * el prompt y se tiraba; este módulo la convierte en un **prior verificable**.
 *
 * Por qué importa: cuando `file_search` no recupera nada, el modelo responde
 * —correctamente— con un JSON vacío en lugar de inventar. Ese JSON pasa
 * `jsonShapeGuardrail`, que es una puerta *sintáctica*: valida la forma, no la
 * sustancia. Sin un contraste externo, «no lo encontré» es indistinguible de
 * «no existe», y el pipeline acaba diciéndole al usuario que sus documentos no
 * traen la información. Ocurrió en producción el 2026-07-28 con un PCAP que sí
 * llevaba los criterios de adjudicación (`SPEC.md` §11.4).
 *
 * Nada aquí llama al modelo ni al SDK: son funciones puras y el módulo se
 * type-checkea de verdad (sin `@ts-nocheck`), porque es la pieza de la que
 * depende decidir si un bloque se reintenta o se da por bueno.
 */

import type { BlockName } from './blocks.ts';
import type { DocumentEntry, DocumentMap } from './document-map.ts';

/** Banderas por documento que el mapa documental emite en Fase B. */
export type DocumentMapFlag =
    | 'contienePresupuesto'
    | 'contienePlazos'
    | 'contieneCriterios'
    | 'contieneSolvencia'
    | 'contieneRequisitos'
    | 'contieneRestricciones'
    | 'contieneModeloServicio';

/**
 * Bloque → bandera del mapa que promete su contenido.
 *
 * `datosGenerales` y `anexosYObservaciones` se quedan fuera **a propósito**: el
 * mapa no emite bandera para ellos, así que no hay prior con el que contrastar
 * y su comportamiento no cambia. Añadir una entrada aquí es lo único necesario
 * para que un bloque nuevo entre en el mecanismo.
 */
export const BLOCK_EXPECTATIONS = {
    economico: 'contienePresupuesto',
    duracionYProrrogas: 'contienePlazos',
    criteriosAdjudicacion: 'contieneCriterios',
    requisitosSolvencia: 'contieneSolvencia',
    requisitosTecnicos: 'contieneRequisitos',
    restriccionesYRiesgos: 'contieneRestricciones',
    modeloServicio: 'contieneModeloServicio',
} as const satisfies Partial<Record<BlockName, DocumentMapFlag>>;

export type ExpectedBlockName = keyof typeof BLOCK_EXPECTATIONS;

/**
 * Documentos que el mapa señaló como portadores de este bloque.
 *
 * Devuelve la lista completa —no un booleano— porque sirve para dos cosas: para
 * saber si había expectativa y para dirigir la re-consulta hacia el fichero
 * concreto.
 */
export function documentsPromising(documentMap: DocumentMap | null | undefined, blockName: BlockName): DocumentEntry[] {
    const flag = BLOCK_EXPECTATIONS[blockName as ExpectedBlockName] as DocumentMapFlag | undefined;
    if (!flag) return [];
    const documentos = documentMap?.documentos;
    if (!Array.isArray(documentos)) return [];
    return documentos.filter((doc) => doc?.[flag] === true);
}

// ─── Predicado de vacío ──────────────────────────────────────────────────────
//
// Deliberadamente separado de `evaluateObjectQuality`/`evaluateArraysQuality`
// de la Fase E: aquella puntúa la sección **consolidada** y esta juzga el
// bloque **crudo**, antes de consolidar. Unificarlas ataría la decisión de
// reintentar un bloque al resultado de una fase posterior, que es justo lo que
// no puede pasar: el reintento tiene que ocurrir mientras el vector store sigue
// vivo y dentro del presupuesto de la slice.
//
// Los predicados son explícitos por bloque en vez de un recorrido genérico
// porque los defaults del schema mienten: `EconomicoSchema.moneda` vale `'EUR'`
// aunque no se haya extraído un solo importe, así que un walker genérico
// declararía "con contenido" un bloque económico completamente vacío.

/** Longitud de un array, 0 si no lo es. */
function count(value: unknown): number {
    return Array.isArray(value) ? value.length : 0;
}

/** `true` si hay número utilizable, desenvolviendo TrackedField si hace falta. */
function hasNumber(value: unknown): boolean {
    const raw =
        value !== null && typeof value === 'object' && 'value' in (value as Record<string, unknown>)
            ? (value as Record<string, unknown>).value
            : value;
    return typeof raw === 'number' && Number.isFinite(raw);
}

/** `true` si hay texto no vacío, desenvolviendo TrackedField si hace falta. */
function hasText(value: unknown): boolean {
    const raw =
        value !== null && typeof value === 'object' && 'value' in (value as Record<string, unknown>)
            ? (value as Record<string, unknown>).value
            : value;
    return typeof raw === 'string' && raw.trim().length > 0;
}

function section(data: unknown): Record<string, unknown> {
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
}

/**
 * Señal mínima por bloque: qué tiene que traer para considerarse no vacío.
 * Cada entrada nombra solo los campos que el usuario vería en el dashboard,
 * nunca los que el schema rellena por defecto.
 */
const HAS_SIGNAL: Record<ExpectedBlockName, (data: Record<string, unknown>) => boolean> = {
    economico: (d) =>
        hasNumber(d.presupuestoBaseLicitacion) ||
        hasNumber(d.valorEstimadoContrato) ||
        hasNumber(d.importeIVA) ||
        count(d.desglosePorLotes) > 0,

    duracionYProrrogas: (d) =>
        hasNumber(d.duracionMeses) ||
        hasNumber(d.prorrogaMeses) ||
        hasNumber(d.prorrogaMaxima) ||
        hasText(d.fechaInicio) ||
        hasText(d.fechaFin),

    // El umbral de anormalidad NO cuenta como señal. Es un campo accesorio y la
    // sección existe para los criterios. Incluirlo —como hacía la primera
    // versión— dejó pasar en producción (job `8e851069`) un bloque con el
    // umbral citado y CERO criterios: el mecanismo no disparó, no hubo
    // re-consulta, y el usuario volvió a leer que sus documentos no los traían.
    criteriosAdjudicacion: (d) => count(d.subjetivos) > 0 || count(d.objetivos) > 0,

    requisitosSolvencia: (d) => {
        const economica = section(d.economica);
        return hasNumber(economica.cifraNegocioAnualMinima) || count(d.tecnica) > 0 || count(d.profesional) > 0;
    },

    requisitosTecnicos: (d) => count(d.funcionales) > 0 || count(d.normativa) > 0,

    restriccionesYRiesgos: (d) => count(d.killCriteria) > 0 || count(d.riesgos) > 0 || count(d.penalizaciones) > 0,

    modeloServicio: (d) => count(d.sla) > 0 || count(d.equipoMinimo) > 0,
};

/**
 * Invariante que hace que todo esto funcione, aprendida rompiéndola en
 * producción (2026-07-28, job `8e851069`):
 *
 * > **Cada predicado debe ser al menos tan estricto como la noción de vacío que
 * > la Fase E aplica a la misma sección.**
 *
 * Si el bloque se declara «con contenido» y la Fase E puntúa la sección
 * `VACIO`, la re-consulta no se dispara nunca y el diagnóstico cae en
 * `missing_in_uploaded_docs` — es decir, se culpa al documento, que es
 * exactamente el fallo que este módulo viene a cerrar. `criteriosAdjudicacion`
 * incumplía la invariante al aceptar `umbralAnormalidad` como señal mientras
 * `evaluateArraysQuality` solo mira `subjetivos` y `objetivos`.
 *
 * Ser **más** estricto que la Fase E sí es seguro: como mucho provoca una
 * re-consulta de más sobre una sección pobre. Por eso `economico` ignora
 * `moneda` aunque `evaluateObjectQuality` la cuente.
 */

/**
 * `true` solo si el bloque tiene predicado conocido **y** no aporta señal.
 *
 * Para un bloque sin predicado devuelve siempre `false`: no afirmamos que algo
 * está vacío cuando no sabemos juzgarlo. El sesgo es deliberado — un falso
 * "vacío" dispararía re-consultas inútiles y acusaría de fallo a extracciones
 * correctas, que es el bug espejo del que este módulo viene a cerrar.
 */
export function isBlockEmpty(blockName: BlockName, data: unknown): boolean {
    const predicate = HAS_SIGNAL[blockName as ExpectedBlockName];
    if (!predicate) return false;
    return !predicate(section(data));
}

/**
 * `true` cuando el bloque vino vacío **y** el mapa prometía su contenido.
 * Es la contradicción entre dos lecturas independientes del mismo corpus, y el
 * único disparador de la re-consulta dirigida.
 */
export function isEmptyDespiteMap(
    blockName: BlockName,
    data: unknown,
    documentMap: DocumentMap | null | undefined
): boolean {
    if (!isBlockEmpty(blockName, data)) return false;
    return documentsPromising(documentMap, blockName).length > 0;
}
