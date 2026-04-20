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
import type { AnalysisPartialReason } from '../../../../src/shared/analysis-contract.ts';

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

function derivePartialReasons(context: PartialReasonContext): AnalysisPartialReason[] {
    const { overall, bySection, missingCriticalFields, ingestion, extraction } = context;
    const reasons = new Set<AnalysisPartialReason>();

    if (ingestion && (ingestion.indexingTimedOut || ingestion.failedFiles > 0 || ingestion.zeroCompletedFiles)) {
        reasons.add('ocr_or_indexing_low_signal');
    }

    if (extraction?.degradedByRateLimit) {
        reasons.add('rate_limited_degraded');
    } else if (extraction?.sawRateLimit) {
        reasons.add('rate_limited_recovered');
    }

    const adminSections = ['datosGenerales', 'criteriosAdjudicacion', 'requisitosSolvencia'] as const;
    const technicalSections = ['requisitosTecnicos', 'restriccionesYRiesgos', 'modeloServicio'] as const;
    const weakAdminSections = adminSections.filter((section) => bySection[section] === 'VACIO').length;
    const strongAdminSignal = adminSections.some((section) => bySection[section] !== 'VACIO');
    const weakTechnicalSections = technicalSections.filter((section) => bySection[section] === 'VACIO').length;
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

// ─── Helper functions ─────────────────────────────────────────────────────────

function evaluateSectionQuality(values: unknown[]): 'COMPLETO' | 'PARCIAL' | 'VACIO' {
    const nonEmpty = values.filter((v) => {
        if (v === null || v === undefined || v === '' || v === 0) return false;
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
        if (v === null || v === undefined || v === '' || v === 0) return false;
        if (Array.isArray(v) && v.length === 0) return false;
        return true;
    });
    if (nonEmpty.length === 0) return 'VACIO';
    if (nonEmpty.length >= values.length * 0.7) return 'COMPLETO';
    return 'PARCIAL';
}
