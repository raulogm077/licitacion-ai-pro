/**
 * Fase E: Validación Final
 *
 * Verifica consistencia, completitud y calidad del resultado consolidado.
 * Genera el workflow con quality assessment.
 */
import type { CanonicalResult, Quality, Workflow } from '../../_shared/schemas/canonical.ts';
import type { ConsolidationResult } from './consolidation.ts';
import type { IngestionDiagnostics } from './ingestion.ts';
import type { BlockExtractionDiagnostics } from './block-extraction.ts';
import type { AnalysisPartialReason, SectionDiagnosticWire } from '../../../../src/shared/analysis-contract.ts';

export interface ValidationInput {
    consolidated: ConsolidationResult;
    ingestion?: IngestionDiagnostics;
    extraction?: BlockExtractionDiagnostics;
    onProgress?: (msg: string) => void;
}

export interface ValidationOutput {
    result: CanonicalResult;
    workflow: Workflow;
}

// Critical fields that must be checked
const CRITICAL_FIELDS = [
    'datosGenerales.titulo',
    'datosGenerales.organoContratacion',
    'datosGenerales.presupuesto',
    'datosGenerales.moneda',
    'datosGenerales.plazoEjecucionMeses',
    'datosGenerales.cpv',
] as const;

export function runValidation(input: ValidationInput): ValidationOutput {
    const { consolidated, ingestion, extraction, onProgress } = input;
    const { result, allEvidences, allWarnings, allAmbiguousFields } = consolidated;

    onProgress?.('Validando resultado...');

    // 1. Check missing critical fields
    const missingCriticalFields: string[] = [];
    const dg = result.datosGenerales;

    if (!dg.titulo.value || dg.titulo.status === 'no_encontrado') {
        missingCriticalFields.push('datosGenerales.titulo');
    }
    if (!dg.organoContratacion.value || dg.organoContratacion.status === 'no_encontrado') {
        missingCriticalFields.push('datosGenerales.organoContratacion');
    }
    if ((!dg.presupuesto.value || dg.presupuesto.value === 0) && dg.presupuesto.status !== 'extraido') {
        missingCriticalFields.push('datosGenerales.presupuesto');
    }
    if (
        (!dg.plazoEjecucionMeses.value || dg.plazoEjecucionMeses.value === 0) &&
        dg.plazoEjecucionMeses.status !== 'extraido'
    ) {
        missingCriticalFields.push('datosGenerales.plazoEjecucionMeses');
    }
    if (!dg.cpv.value || dg.cpv.value.length === 0) {
        missingCriticalFields.push('datosGenerales.cpv');
    }

    // 2. Evaluate quality per section
    const bySection: Record<string, 'COMPLETO' | 'PARCIAL' | 'VACIO'> = {};

    bySection['datosGenerales'] = evaluateSectionQuality([
        dg.titulo.value,
        dg.organoContratacion.value,
        dg.presupuesto.value,
        dg.plazoEjecucionMeses.value,
    ]);

    bySection['economico'] = evaluateObjectQuality(result.economico);
    bySection['duracionYProrrogas'] = evaluateObjectQuality(result.duracionYProrrogas);

    bySection['criteriosAdjudicacion'] = evaluateArraysQuality([
        result.criteriosAdjudicacion?.subjetivos,
        result.criteriosAdjudicacion?.objetivos,
    ]);

    bySection['requisitosSolvencia'] = evaluateArraysQuality(
        [result.requisitosSolvencia?.tecnica, result.requisitosSolvencia?.profesional],
        result.requisitosSolvencia?.economica?.cifraNegocioAnualMinima ?? undefined
    );

    bySection['requisitosTecnicos'] = evaluateArraysQuality([
        result.requisitosTecnicos?.funcionales,
        result.requisitosTecnicos?.normativa,
    ]);

    bySection['restriccionesYRiesgos'] = evaluateArraysQuality([
        result.restriccionesYRiesgos?.killCriteria,
        result.restriccionesYRiesgos?.riesgos,
        result.restriccionesYRiesgos?.penalizaciones,
    ]);

    bySection['modeloServicio'] = evaluateArraysQuality([
        result.modeloServicio?.sla,
        result.modeloServicio?.equipoMinimo,
    ]);

    // 3. Overall quality
    let overall: Quality['overall'];
    if (missingCriticalFields.length > 0) {
        const allEmpty = Object.values(bySection).every((s) => s === 'VACIO');
        overall = allEmpty ? 'VACIO' : 'PARCIAL';
    } else {
        const allComplete = Object.values(bySection).every((s) => s === 'COMPLETO');
        overall = allComplete ? 'COMPLETO' : 'PARCIAL';
    }

    // 4. Evidence coverage
    const totalCriticalFields = CRITICAL_FIELDS.length;
    const fieldsWithEvidence = CRITICAL_FIELDS.filter((fp) =>
        allEvidences.some((e) => e.fieldPath === fp || fp.startsWith(e.fieldPath))
    ).length;

    // 5. Structured partial reasons
    const partialReasons = derivePartialReasons({
        overall,
        bySection,
        missingCriticalFields,
        ingestion,
        extraction,
    });
    const sectionDiagnostics = deriveSectionDiagnostics({
        bySection,
        evidences: allEvidences,
        warnings: allWarnings,
        emptyDespiteMapBlocks: extraction?.emptyDespiteMapBlocks || [],
    });

    // 6. Build workflow
    const now = new Date().toISOString();
    const workflow: Workflow = {
        status: 'completed',
        quality: {
            overall,
            bySection,
            missingCriticalFields,
            ambiguous_fields: [...new Set(allAmbiguousFields)],
            warnings: allWarnings,
            partial_reasons: partialReasons,
            section_diagnostics: sectionDiagnostics,
        },
        evidences: allEvidences.map((e) => ({
            ...e,
            fieldPath: e.fieldPath,
        })),
        phases: {
            ingestion: { status: 'completed' },
            document_map: { status: 'completed' },
            extraction: { status: 'completed' },
            consolidation: { status: 'completed' },
            validation: { status: 'completed', completedAt: now },
        },
        updated_at: now,
        created_at: now,
    };

    onProgress?.(
        `Validación completada: ${overall}, ${missingCriticalFields.length} campos críticos faltantes, ${fieldsWithEvidence}/${totalCriticalFields} con evidencia`
    );

    return { result, workflow };
}

interface PartialReasonContext {
    overall: Quality['overall'];
    bySection: Record<string, 'COMPLETO' | 'PARCIAL' | 'VACIO'>;
    missingCriticalFields: string[];
    ingestion?: IngestionDiagnostics;
    extraction?: BlockExtractionDiagnostics;
}

interface SectionDiagnosticContext {
    bySection: Record<string, 'COMPLETO' | 'PARCIAL' | 'VACIO'>;
    evidences: Array<{ fieldPath: string; quote: string; pageHint?: string; confidence?: number }>;
    warnings: string[];
    /**
     * Bloques que la Fase C dejó vacíos pese a que el mapa documental prometía
     * su contenido. Es la única señal que permite no acusar al documento.
     */
    emptyDespiteMapBlocks: string[];
}

function derivePartialReasons(context: PartialReasonContext): AnalysisPartialReason[] {
    const { overall, bySection, missingCriticalFields, ingestion, extraction } = context;
    const reasons = new Set<AnalysisPartialReason>();

    // Only blame the document when the indexing counts are REAL. `countsUnreliable`
    // cubre las dos formas en que dejan de serlo —el sondeo falló, o respondió
    // con todo a cero porque el lote nunca se registró— y en ambas afirmar
    // "OCR pobre/señal baja" desorienta al usuario. Pasó dos veces: 2026-07-12
    // con un sondeo limitado por rate limit, y 2026-07-28 con un sondeo que
    // salió en la primera vuelta antes de que hubiera nada que contar. Ambos
    // sobre PDFs con texto digital perfecto.
    if (
        ingestion &&
        !ingestion.countsUnreliable &&
        (ingestion.indexingTimedOut || ingestion.failedFiles > 0 || ingestion.zeroCompletedFiles)
    ) {
        reasons.add('ocr_or_indexing_low_signal');
    }

    if (extraction?.degradedByRateLimit) {
        reasons.add('rate_limited_degraded');
    } else if (extraction?.sawRateLimit) {
        reasons.add('rate_limited_recovered');
    }

    // Una sección vacía por fallo de recuperación NO es documentación que falte.
    // Sin esta exclusión el usuario recibía las dos mentiras a la vez: el
    // diagnóstico de sección diciendo que su PCAP no trae los criterios, y el
    // motivo global pidiéndole que subiera la pieza administrativa que ya había
    // subido. Aquí se cuenta como fallo nuestro y se declara como tal.
    const retrievalFailures = extraction?.emptyDespiteMapBlocks || [];
    if (retrievalFailures.length > 0) {
        reasons.add('extraction_incomplete');
    }
    const isDocumentGap = (section: string) => bySection[section] === 'VACIO' && !retrievalFailures.includes(section);

    const adminSections = ['datosGenerales', 'criteriosAdjudicacion', 'requisitosSolvencia'] as const;
    const technicalSections = ['requisitosTecnicos', 'restriccionesYRiesgos', 'modeloServicio'] as const;
    const weakAdminSections = adminSections.filter(isDocumentGap).length;
    const strongAdminSignal = adminSections.some((section) => bySection[section] !== 'VACIO');
    const weakTechnicalSections = technicalSections.filter(isDocumentGap).length;
    const strongTechnicalSignal = technicalSections.some((section) => bySection[section] !== 'VACIO');

    if ((weakAdminSections >= 2 || missingCriticalFields.length >= 3) && strongTechnicalSignal) {
        reasons.add('missing_administrative_content');
    }

    if (weakTechnicalSections >= 2 && strongAdminSignal) {
        reasons.add('missing_technical_content');
    }

    const nonEmptySections = Object.values(bySection).filter((status) => status !== 'VACIO').length;
    if (overall !== 'COMPLETO' && (missingCriticalFields.length >= 4 || nonEmptySections <= 1)) {
        reasons.add('document_insufficient');
    }

    return [...reasons];
}

function deriveSectionDiagnostics(context: SectionDiagnosticContext): Record<string, SectionDiagnosticWire> {
    const diagnostics: Record<string, SectionDiagnosticWire> = {};

    for (const [sectionName, status] of Object.entries(context.bySection)) {
        const evidenceCount = countSectionEvidence(sectionName, context.evidences);
        const schemaRecovered = context.warnings.some((warning) =>
            warning.includes(`Sección ${sectionName} recuperada con fallback por error de schema`)
        );

        if (schemaRecovered) {
            diagnostics[sectionName] = {
                code: 'schema_recovered',
                message: `La sección ${sectionName} se recuperó parcialmente tras corregir un bloque mal tipado.`,
                evidenceCount,
            };
            continue;
        }

        if (status === 'VACIO' && evidenceCount > 0) {
            diagnostics[sectionName] = {
                code: 'extraction_gap',
                message: `La sección ${sectionName} tiene evidencias útiles, pero el resultado consolidado quedó vacío o degradado.`,
                evidenceCount,
            };
            continue;
        }

        // Antes de culpar al documento: si el mapa documental situaba esta
        // sección en un fichero concreto y aun así la extracción volvió vacía
        // tras la búsqueda dirigida, el fallo es nuestro, no del expediente.
        // Decir lo contrario manda al usuario a buscar un documento que ya
        // subió (mismo error que el falso «OCR pobre» de 2026-07-12).
        //
        // No basta con exigir `VACIO`. La Fase C **sabe** que el bloque volvió
        // vacío; la Fase E solo tiene una heurística que confunde un default
        // con contenido: `economico` puntúa PARCIAL por `moneda: 'EUR'` aunque
        // los tres importes sean null, y así el job `8e851069` acabó
        // reportando `present` —«contiene información utilizable»— sobre una
        // sección sin un solo dato ni evidencia. Cuando la certeza y la
        // heurística chocan manda la certeza, acotada por `evidenceCount === 0`
        // para no pisar una sección que la consolidación sí rellenó desde otro
        // bloque.
        if (context.emptyDespiteMapBlocks.includes(sectionName) && (status === 'VACIO' || evidenceCount === 0)) {
            diagnostics[sectionName] = {
                code: 'retrieval_failed',
                message: `La sección ${sectionName} figura en el expediente según el mapa documental, pero la extracción no logró recuperarla.`,
                evidenceCount,
            };
            continue;
        }

        if (status === 'VACIO') {
            diagnostics[sectionName] = {
                code: 'missing_in_uploaded_docs',
                message: `La sección ${sectionName} no muestra señal suficiente en los documentos subidos.`,
                evidenceCount,
            };
            continue;
        }

        diagnostics[sectionName] = {
            code: 'present',
            message: `La sección ${sectionName} contiene información utilizable para el dashboard.`,
            evidenceCount,
        };
    }

    return diagnostics;
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function evaluateSectionQuality(values: unknown[]): 'COMPLETO' | 'PARCIAL' | 'VACIO' {
    const nonEmpty = values.filter((v) => {
        if (v === null || v === undefined || v === '') return false;
        if (Array.isArray(v) && v.length === 0) return false;
        return true;
    });

    if (nonEmpty.length === 0) return 'VACIO';
    if (nonEmpty.length === values.length) return 'COMPLETO';
    return 'PARCIAL';
}

function evaluateArraysQuality(
    arrays: (unknown[] | undefined)[],
    extraValue?: number
): 'COMPLETO' | 'PARCIAL' | 'VACIO' {
    const totalItems = arrays.reduce((sum, arr) => sum + (arr?.length || 0), 0);
    const hasExtra = extraValue !== undefined && extraValue > 0;
    if (totalItems === 0 && !hasExtra) return 'VACIO';
    if (totalItems > 0) return 'COMPLETO';
    return 'PARCIAL';
}

function evaluateObjectQuality(obj: unknown): 'COMPLETO' | 'PARCIAL' | 'VACIO' {
    if (!obj || typeof obj !== 'object') return 'VACIO';
    const values = Object.values(obj);
    const nonEmpty = values.filter((v) => {
        // Un TrackedField vacío es un envoltorio, no un dato. Desde que los
        // importes llevan grounding, `economico` siempre trae las tres claves
        // presentes; contarlas sin mirar dentro haría que un bloque económico
        // sin un solo importe se reportase como COMPLETO.
        const unwrapped =
            v !== null && typeof v === 'object' && !Array.isArray(v) && 'value' in (v as Record<string, unknown>)
                ? (v as Record<string, unknown>).value
                : v;
        if (unwrapped === null || unwrapped === undefined || unwrapped === '') return false;
        if (Array.isArray(unwrapped) && unwrapped.length === 0) return false;
        return true;
    });
    if (nonEmpty.length === 0) return 'VACIO';
    if (nonEmpty.length >= values.length * 0.7) return 'COMPLETO';
    return 'PARCIAL';
}

function countSectionEvidence(sectionName: string, evidences: Array<{ fieldPath: string }>): number {
    return evidences.filter((evidence) => evidence.fieldPath.startsWith(`${sectionName}.`)).length;
}
