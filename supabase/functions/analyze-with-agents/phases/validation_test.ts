import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { runValidation } from './validation.ts';
import type { ConsolidationResult } from './consolidation.ts';

function createConsolidatedResult(): ConsolidationResult {
    return {
        result: {
            datosGenerales: {
                titulo: { value: 'Expediente de prueba', status: 'extraido', warnings: [] },
                organoContratacion: { value: 'Entidad pública', status: 'extraido', warnings: [] },
                presupuesto: { value: 100000, status: 'extraido', warnings: [] },
                moneda: { value: 'EUR', status: 'extraido', warnings: [] },
                plazoEjecucionMeses: { value: 12, status: 'extraido', warnings: [] },
                cpv: { value: ['72000000-5'], status: 'extraido', warnings: [] },
                fechaLimitePresentacion: null,
                tipoContrato: 'Servicios',
                procedimiento: 'Abierto',
            },
            economico: {
                presupuestoBaseLicitacion: 100000,
                valorEstimadoContrato: 120000,
                importeIVA: null,
                tipoIVA: null,
                desglosePorLotes: [],
                moneda: 'EUR',
            },
            duracionYProrrogas: {
                duracionMeses: 12,
                prorrogaMeses: 6,
                prorrogaMaxima: 18,
                fechaInicio: null,
                fechaFin: null,
                observaciones: null,
            },
            criteriosAdjudicacion: {
                subjetivos: [{ descripcion: 'Memoria técnica', ponderacion: 40, subcriterios: [] }],
                objetivos: [{ descripcion: 'Oferta económica', ponderacion: 60 }],
            },
            requisitosSolvencia: {
                economica: { cifraNegocioAnualMinima: 100000 },
                tecnica: [{ descripcion: 'Contrato similar', proyectosSimilaresRequeridos: 2, importeMinimoProyecto: 30000 }],
                profesional: [],
            },
            requisitosTecnicos: {
                funcionales: [],
                normativa: [],
            },
            restriccionesYRiesgos: {
                killCriteria: [],
                riesgos: [],
                penalizaciones: [],
            },
            modeloServicio: {
                sla: [],
                equipoMinimo: [],
            },
            anexosYObservaciones: {
                anexosIdentificados: [],
                observaciones: [],
            },
        },
        allEvidences: [],
        allWarnings: [],
        allAmbiguousFields: [],
    };
}

Deno.test('runValidation marks missing technical content as a structured partial reason', () => {
    const { workflow } = runValidation({
        consolidated: createConsolidatedResult(),
    });

    assertEquals(workflow.quality?.overall, 'PARCIAL');
    assert(workflow.quality?.partial_reasons?.includes('missing_technical_content'));
});

Deno.test('runValidation surfaces ingestion and retry degradation reasons', () => {
    const consolidated = createConsolidatedResult();
    consolidated.result.datosGenerales.organoContratacion = { value: null, status: 'no_encontrado', warnings: [] };
    consolidated.result.datosGenerales.plazoEjecucionMeses = { value: null, status: 'no_encontrado', warnings: [] };
    consolidated.result.datosGenerales.cpv = { value: [], status: 'no_encontrado', warnings: [] };

    const { workflow } = runValidation({
        consolidated,
        ingestion: {
            completedFiles: 0,
            failedFiles: 1,
            inProgressFiles: 0,
            indexingElapsedMs: 90000,
            indexingTimedOut: true,
            zeroCompletedFiles: true,
        },
        extraction: {
            sawRateLimit: true,
            degradedByRateLimit: true,
            degradedBlocks: ['datosGenerales'],
        },
    });

    assertEquals(workflow.quality?.overall, 'PARCIAL');
    assert(workflow.quality?.partial_reasons?.includes('ocr_or_indexing_low_signal'));
    assert(workflow.quality?.partial_reasons?.includes('rate_limited_degraded'));
});

Deno.test('runValidation marks very sparse results as document_insufficient', () => {
    const consolidated = createConsolidatedResult();
    consolidated.result.datosGenerales.organoContratacion = { value: null, status: 'no_encontrado', warnings: [] };
    consolidated.result.datosGenerales.presupuesto = { value: null, status: 'no_encontrado', warnings: [] };
    consolidated.result.datosGenerales.moneda = { value: null, status: 'no_encontrado', warnings: [] };
    consolidated.result.datosGenerales.plazoEjecucionMeses = { value: null, status: 'no_encontrado', warnings: [] };
    consolidated.result.datosGenerales.cpv = { value: [], status: 'no_encontrado', warnings: [] };
    consolidated.result.criteriosAdjudicacion = { subjetivos: [], objetivos: [] };
    consolidated.result.requisitosSolvencia = {
        economica: { cifraNegocioAnualMinima: null },
        tecnica: [],
        profesional: [],
    };
    consolidated.result.requisitosTecnicos = { funcionales: [], normativa: [] };
    consolidated.result.restriccionesYRiesgos = { killCriteria: [], riesgos: [], penalizaciones: [] };
    consolidated.result.modeloServicio = { sla: [], equipoMinimo: [] };
    consolidated.result.economico = {
        presupuestoBaseLicitacion: null,
        valorEstimadoContrato: null,
        importeIVA: null,
        tipoIVA: null,
        desglosePorLotes: [],
        moneda: 'EUR',
    };
    consolidated.result.duracionYProrrogas = {
        duracionMeses: null,
        prorrogaMeses: null,
        prorrogaMaxima: null,
        fechaInicio: null,
        fechaFin: null,
        observaciones: null,
    };

    const { workflow } = runValidation({
        consolidated,
    });

    assertEquals(workflow.quality?.overall, 'PARCIAL');
    assert(workflow.quality?.partial_reasons?.includes('document_insufficient'));
});

Deno.test('runValidation attaches structured section diagnostics for present, recovered and missing sections', () => {
    const consolidated = createConsolidatedResult();
    consolidated.result.requisitosSolvencia = {
        economica: { cifraNegocioAnualMinima: null },
        tecnica: [],
        profesional: [],
    };
    consolidated.allWarnings = ['Sección criteriosAdjudicacion recuperada con fallback por error de schema'];
    consolidated.allEvidences = [
        {
            fieldPath: 'criteriosAdjudicacion.objetivos[0]',
            quote: 'Criterio económico: 60 puntos',
            pageHint: '12',
            confidence: 0.91,
        },
    ];

    const { workflow } = runValidation({
        consolidated,
    });

    assertEquals(workflow.quality?.section_diagnostics?.datosGenerales?.code, 'present');
    assertEquals(workflow.quality?.section_diagnostics?.criteriosAdjudicacion?.code, 'schema_recovered');
    assertEquals(workflow.quality?.section_diagnostics?.requisitosSolvencia?.code, 'missing_in_uploaded_docs');
});
