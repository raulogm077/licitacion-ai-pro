/**
 * Metodología por bloque: qué parte de la «Guía de lectura de pliegos» ve cada
 * extractor de la Fase C.
 *
 * Hasta 2026-08-07 los 9 bloques recibían el MISMO prefijo de 4000 caracteres
 * de la guía (§1 y §2.1: la introducción y la prelación documental). Es decir,
 * el bloque de criterios de adjudicación nunca leía la §4 —fórmula de precio,
 * baja temeraria, descomposición de subcriterios—, que es exactamente el método
 * que necesita; y el de solvencia nunca leía la §3. La metodología útil de la
 * guía (§3–§7) ni siquiera llegaba al runtime: `guide-content.ts` venía
 * recortado a los primeros ~4900 caracteres.
 *
 * Este módulo trocea la guía por sus encabezados numerados y asigna a cada
 * bloque el subconjunto pertinente. Dos invariantes:
 *
 * 1. **Sigue siendo método, nunca fuente de datos.** El prompt de sistema lo
 *    dice explícitamente y las citas se verifican contra el texto del
 *    expediente (ADR-003), no contra la guía.
 * 2. **No sube el presupuesto de contexto.** El extracto de cada bloque se
 *    recorta a `GUIDE_EXCERPT_LENGTH`, que es el mismo techo que consumía el
 *    prefijo genérico. Cambia qué 4000 caracteres se envían, no cuántos.
 */

import { GUIDE_CONTENT } from '../guide-content.ts';
import { BLOCK_NAMES } from '../../_shared/schemas/blocks.ts';
import type { BlockName } from '../../_shared/schemas/blocks.ts';
import { GUIDE_EXCERPT_LENGTH } from '../../_shared/config.ts';

/**
 * Índice de secciones de la guía, en el orden en que aparecen en el documento.
 * `heading` es la primera línea literal del encabezado (el PDF original parte
 * los títulos largos en varias líneas; con la primera basta para localizarlo).
 *
 * El orden importa: `sliceSections` busca cada encabezado a partir del
 * anterior, así que una guía reordenada o un encabezado reescrito hacen fallar
 * la carga del módulo en vez de devolver un extracto silenciosamente vacío.
 */
const SECTION_INDEX = [
    { id: '1', heading: '1. Introducción: El Paradigma de la Licitación' },
    { id: '2', heading: '2. Taxonomía y Jerarquía Documental: La Ontología' },
    { id: '2.1', heading: '2.1 El Pliego de Cláusulas Administrativas Particulares (PCAP): El' },
    { id: '2.1.1', heading: '2.1.1 Análisis de la Carátula o Cuadro de Características' },
    { id: '2.1.2', heading: '2.1.2 El Régimen Económico y la Estructura de Precios' },
    { id: '2.2', heading: '2.2 El Pliego de Prescripciones Técnicas (PPT): La Definición del' },
    { id: '2.2.1', heading: '2.2.1 Funcionalidad vs. Solución' },
    { id: '2.2.2', heading: '2.2.2 El Principio de Neutralidad Tecnológica' },
    { id: '2.3', heading: '2.3 Documentación Complementaria y Anexos' },
    { id: '3', heading: '3. Protocolo de Análisis de Viabilidad (Fase' },
    { id: '3.1', heading: '3.1 Validación de Solvencia Económica y Financiera' },
    { id: '3.1.1', heading: '3.1.1 Volumen Anual de Negocios (VAN)' },
    { id: '3.1.2', heading: '3.1.2 Seguro de Responsabilidad Civil' },
    { id: '3.2', heading: '3.2 Validación de Solvencia Técnica y Profesional' },
    { id: '3.2.1', heading: '3.2.1 Análisis de Similitud por CPV' },
    { id: '3.2.2', heading: '3.2.2 Certificaciones y Habilitaciones' },
    { id: '3.3', heading: '3.3 Prohibiciones de Contratar y Conflictos de Interés' },
    { id: '4', heading: '4. Ingeniería Inversa del Motor de Evaluación (The' },
    { id: '4.1', heading: '4.1 Criterios Evaluables mediante Fórmulas (Automáticos)' },
    { id: '4.1.1', heading: '4.1.1 Análisis de la Fórmula de Precio' },
    { id: '4.1.2', heading: '4.1.2 Detección y Cálculo de la Baja Temeraria (Abnormalmente Baja)' },
    { id: '4.2', heading: '4.2 Criterios Sujetos a Juicio de Valor (Subjetivos)' },
    { id: '4.2.1', heading: '4.2.1 Descomposición de Subcriterios' },
    { id: '4.2.2', heading: '4.2.2 Separación de Sobres (Regla de Oro)' },
    { id: '5', heading: '5. Estrategia de Construcción de la Oferta Técnica' },
    { id: '5.1', heading: '5.1 Matriz de Cumplimiento y Trazabilidad (Compliance Matrix)' },
    { id: '5.2', heading: '5.2 Identificación de "Win Themes" y Análisis de Sentimiento' },
    { id: '5.3', heading: '5.3 Estructuración de la Memoria Técnica' },
    { id: '5.4', heading: '5.4 Gestión de Mejoras (Opcionales vs. Obligatorias)' },
    { id: '6', heading: '6. Implementación Técnica para el Agente de IA: Datos' },
    { id: '6.1', heading: '6.1 Esquema JSON para la Extracción de Pliegos' },
    { id: '6.2', heading: '6.2 Estrategias de Prompt Engineering y NLP' },
    { id: '6.3', heading: '6.3 Prevención de Alucinaciones en Datos Críticos' },
    { id: '7', heading: '7. Gestión de Riesgos y Control de Calidad: El Rol de' },
    { id: '7.1', heading: '7.1 Riesgos Contractuales y Operativos' },
    { id: '7.2', heading: '7.2 Riesgos de Exclusión Formal (Checklist Final)' },
    { id: '8', heading: '8. Conclusión' },
] as const;

type SectionId = (typeof SECTION_INDEX)[number]['id'];

/**
 * La guía viene de un PDF y arrastra dos tablas («Tabla 1: Matriz de Prioridad
 * y Extracción Documental», «Tabla 2: Mapeo de Errores Comunes») que la
 * extracción dejó como celdas sueltas, una por línea, sin cabecera ni relación
 * entre ellas. Ocupan 120 y 90 líneas respectivamente y no aportan método
 * legible: cortar la sección donde empiezan evita gastar el presupuesto de
 * contexto en ruido.
 */
const TABLE_MARKER = /\nTabla \d+:/;

function sliceSections(guide: string): Map<string, string> {
    const bounds: Array<{ id: string; start: number }> = [];
    let cursor = 0;

    for (const { id, heading } of SECTION_INDEX) {
        const at = guide.indexOf(`\n${heading}\n`, cursor);
        if (at < 0) {
            throw new Error(
                `guide-methodology: no se encontró el encabezado «${heading}» (sección ${id}) en la guía. ` +
                    'Si la guía cambió, regenera guide-content.ts y actualiza SECTION_INDEX.'
            );
        }
        bounds.push({ id, start: at + 1 });
        cursor = at + 1;
    }

    const sections = new Map<string, string>();
    for (let i = 0; i < bounds.length; i++) {
        const end = i + 1 < bounds.length ? bounds[i + 1].start : guide.length;
        let body = guide.slice(bounds[i].start, end);
        const table = body.match(TABLE_MARKER);
        if (table?.index !== undefined) body = body.slice(0, table.index);
        sections.set(bounds[i].id, body.trim());
    }
    return sections;
}

const SECTIONS = sliceSections(GUIDE_CONTENT);

/**
 * Qué secciones de la guía ve cada bloque.
 *
 * El criterio es «el método que ese bloque necesita para decidir qué extraer y
 * cómo desambiguarlo», no «todo lo que menciona el tema». Por eso §6.3 (regla
 * de grounding: nunca inferir un número, marcarlo como ausente) solo acompaña a
 * los bloques con importes, que son los que tienen algo que alucinar.
 */
const BLOCK_SECTIONS: Record<BlockName, readonly SectionId[]> = {
    // Carátula/cuadro de características: expediente, CPV, NUTS, fechas críticas.
    datosGenerales: ['2.1.1', '6.3'],
    // La distinción PBL vs. VEC y la revisión de precios son el nudo de este bloque.
    economico: ['2.1.2', '6.3'],
    // El plazo de ejecución sale de la carátula; las prórrogas, del VEC.
    duracionYProrrogas: ['2.1.1', '2.1.2'],
    // Ingeniería inversa del motor de puntuación: fórmulas, temeridad, subcriterios.
    criteriosAdjudicacion: ['4.1', '4.1.1', '4.1.2', '4.2', '4.2.1'],
    // Go/No-Go: VAN ≥ 1,5 × VAM, seguro RC, similitud CPV a 3 dígitos, certificaciones.
    requisitosSolvencia: ['3.1', '3.1.1', '3.1.2', '3.2', '3.2.1', '3.2.2'],
    // PPT como fuente: funcional vs. diseño, neutralidad tecnológica, matriz de cumplimiento.
    requisitosTecnicos: ['2.2', '2.2.1', '2.2.2', '5.1'],
    // Exclusión y riesgo: prohibiciones, penalidades, checklist formal, contaminación de sobres.
    restriccionesYRiesgos: ['3.3', '7.1', '7.2', '4.2.2'],
    // SLAs y equipo salen del PPT; las penalidades por SLA, del cuadro del PCAP.
    modeloServicio: ['2.2', '2.2.1', '7.1'],
    // Documentación complementaria y la frontera entre requisito mínimo y mejora.
    anexosYObservaciones: ['2.3', '5.4'],
};

/**
 * Recorta al techo de contexto sin partir una línea por la mitad: una frase
 * cortada a mitad de palabra es peor entrada para el modelo que una línea menos.
 */
function capToBudget(text: string): string {
    if (text.length <= GUIDE_EXCERPT_LENGTH) return text;
    const cut = text.slice(0, GUIDE_EXCERPT_LENGTH);
    const lastBreak = cut.lastIndexOf('\n');
    return (lastBreak > 0 ? cut.slice(0, lastBreak) : cut).trimEnd();
}

const BLOCK_METHODOLOGY: Record<BlockName, string> = Object.fromEntries(
    BLOCK_NAMES.map((block) => [
        block,
        capToBudget(
            BLOCK_SECTIONS[block]
                .map((id) => SECTIONS.get(id) ?? '')
                .filter(Boolean)
                .join('\n\n')
        ),
    ])
) as Record<BlockName, string>;

/** Extracto de metodología de la guía pertinente para `blockName`. */
export function methodologyForBlock(blockName: BlockName): string {
    return BLOCK_METHODOLOGY[blockName];
}

/** Secciones asignadas a `blockName`. Expuesto para los tests del contrato. */
export function sectionsForBlock(blockName: BlockName): readonly string[] {
    return BLOCK_SECTIONS[blockName];
}
