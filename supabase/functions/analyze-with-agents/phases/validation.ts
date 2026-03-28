/**
 * Fase E: Validación Final
 *
 * Verifica consistencia, completitud y calidad del resultado consolidado.
 * Genera el workflow con quality assessment.
 */
import type { CanonicalResult, Quality, Workflow } from '../../_shared/schemas/canonical.ts';
import type { ConsolidationResult } from './consolidation.ts';

export interface ValidationInput {
    consolidated: ConsolidationResult;
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
    const { consolidated, onProgress } = input;
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
        result.requisitosSolvencia?.economica?.cifraNegocioAnualMinima
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

    // 5. Build workflow
    const now = new Date().toISOString();
    const workflow: Workflow = {
        status: 'completed',
        quality: {
            overall,
            bySection,
            missingCriticalFields,
            ambiguous_fields: [...new Set(allAmbiguousFields)],
            warnings: allWarnings,
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
