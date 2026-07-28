import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { runValidation } from './validation.ts';
import type { ConsolidationResult } from './consolidation.ts';

/**
 * Envoltorio TrackedField para los fixtures. Los importes y las ponderaciones
 * llevan grounding desde el cierre de la Guía §6.3, así que un fixture con un
 * número plano ya no representa la forma que produce el pipeline.
 */
function tf<T>(value: T, status: 'extraido' | 'ambiguo' | 'no_encontrado' | 'derivado_tecnico' = 'extraido') {
    return { value, status, warnings: [] as string[] };
}

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
                presupuestoBaseLicitacion: tf(100000),
                valorEstimadoContrato: tf(120000),
                importeIVA: tf(null, 'no_encontrado'),
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
                subjetivos: [{ descripcion: 'Memoria técnica', ponderacion: tf(40), subcriterios: [] }],
                objetivos: [{ descripcion: 'Oferta económica', ponderacion: tf(60) }],
                umbralAnormalidad: tf('Baja del 25% sobre el PBL'),
            },
            requisitosSolvencia: {
                economica: { cifraNegocioAnualMinima: 100000 },
                tecnica: [
                    { descripcion: 'Contrato similar', proyectosSimilaresRequeridos: 2, importeMinimoProyecto: 30000 },
                ],
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
            emptyDespiteMapBlocks: [],
        },
    });

    assertEquals(workflow.quality?.overall, 'PARCIAL');
    assert(workflow.quality?.partial_reasons?.includes('ocr_or_indexing_low_signal'));
    assert(workflow.quality?.partial_reasons?.includes('rate_limited_degraded'));
});

Deno.test('runValidation does NOT blame the document when the indexing poll failed (counts unknown)', () => {
    const { workflow } = runValidation({
        consolidated: createConsolidatedResult(),
        ingestion: {
            completedFiles: 0,
            failedFiles: 0,
            inProgressFiles: 0,
            indexingElapsedMs: 90000,
            indexingTimedOut: true,
            zeroCompletedFiles: false,
            pollFailed: true,
        },
        extraction: {
            sawRateLimit: true,
            degradedByRateLimit: false,
            degradedBlocks: [],
            emptyDespiteMapBlocks: [],
        },
    });

    // Rate limit recovery is reported, but the PDF is not accused of low signal.
    assert(workflow.quality?.partial_reasons?.includes('rate_limited_recovered'));
    assert(!workflow.quality?.partial_reasons?.includes('ocr_or_indexing_low_signal'));
});

Deno.test('runValidation keeps the low-signal reason when file counts are real', () => {
    const { workflow } = runValidation({
        consolidated: createConsolidatedResult(),
        ingestion: {
            completedFiles: 0,
            failedFiles: 1,
            inProgressFiles: 0,
            indexingElapsedMs: 90000,
            indexingTimedOut: false,
            zeroCompletedFiles: true,
            pollFailed: false,
        },
    });

    assert(workflow.quality?.partial_reasons?.includes('ocr_or_indexing_low_signal'));
});

Deno.test('runValidation marks very sparse results as document_insufficient', () => {
    const consolidated = createConsolidatedResult();
    consolidated.result.datosGenerales.organoContratacion = { value: null, status: 'no_encontrado', warnings: [] };
    consolidated.result.datosGenerales.presupuesto = { value: null, status: 'no_encontrado', warnings: [] };
    consolidated.result.datosGenerales.moneda = { value: null, status: 'no_encontrado', warnings: [] };
    consolidated.result.datosGenerales.plazoEjecucionMeses = { value: null, status: 'no_encontrado', warnings: [] };
    consolidated.result.datosGenerales.cpv = { value: [], status: 'no_encontrado', warnings: [] };
    consolidated.result.criteriosAdjudicacion = {
        subjetivos: [],
        objetivos: [],
        umbralAnormalidad: tf(null, 'no_encontrado'),
    };
    consolidated.result.requisitosSolvencia = {
        economica: { cifraNegocioAnualMinima: null },
        tecnica: [],
        profesional: [],
    };
    consolidated.result.requisitosTecnicos = { funcionales: [], normativa: [] };
    consolidated.result.restriccionesYRiesgos = { killCriteria: [], riesgos: [], penalizaciones: [] };
    consolidated.result.modeloServicio = { sla: [], equipoMinimo: [] };
    consolidated.result.economico = {
        presupuestoBaseLicitacion: tf(null, 'no_encontrado'),
        valorEstimadoContrato: tf(null, 'no_encontrado'),
        importeIVA: tf(null, 'no_encontrado'),
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

Deno.test('runValidation treats numeric 0 as a present value, not as empty', () => {
    const consolidated = createConsolidatedResult();
    // importeIVA: 0 is real data (exempt contract), not a missing field.
    consolidated.result.economico = {
        presupuestoBaseLicitacion: tf(null, 'no_encontrado'),
        valorEstimadoContrato: tf(null, 'no_encontrado'),
        importeIVA: tf(0),
        tipoIVA: 0,
        desglosePorLotes: [],
        moneda: '',
    };

    const { workflow } = runValidation({ consolidated });

    // With two real zeros present the section must not be VACIO.
    assert(workflow.quality?.bySection?.economico !== 'VACIO');
});

Deno.test('runValidation still treats null, undefined and empty string as empty', () => {
    const consolidated = createConsolidatedResult();
    consolidated.result.economico = {
        presupuestoBaseLicitacion: tf(null, 'no_encontrado'),
        valorEstimadoContrato: tf(null, 'no_encontrado'),
        importeIVA: tf(null, 'no_encontrado'),
        tipoIVA: null,
        desglosePorLotes: [],
        moneda: '',
    };

    const { workflow } = runValidation({ consolidated });

    assertEquals(workflow.quality?.bySection?.economico, 'VACIO');
});

// ─── No culpar al documento de un fallo propio ───────────────────────────────
//
// Incidente 2026-07-28: el mapa documental situaba los criterios de
// adjudicación en el PCAP, la extracción volvió vacía, y la Fase E respondió
// `missing_in_uploaded_docs` — «tus documentos no muestran señal suficiente» —
// sobre un PCAP que sí los llevaba. Es la misma familia del falso «OCR pobre»
// de 2026-07-12: el pipeline falla y el usuario carga con la culpa.

Deno.test('runValidation no acusa al documento cuando el fallo fue de recuperación', () => {
    const consolidated = createConsolidatedResult();
    consolidated.result.criteriosAdjudicacion = {
        subjetivos: [],
        objetivos: [],
        umbralAnormalidad: tf(null, 'no_encontrado'),
    };

    const { workflow } = runValidation({
        consolidated,
        extraction: {
            sawRateLimit: false,
            degradedByRateLimit: false,
            degradedBlocks: [],
            emptyDespiteMapBlocks: ['criteriosAdjudicacion'],
        },
    });

    const diagnostico = workflow.quality?.section_diagnostics?.criteriosAdjudicacion;
    assertEquals(diagnostico?.code, 'retrieval_failed');
    assert(
        !diagnostico?.message.includes('documentos subidos'),
        'el mensaje no debe insinuar que falta documentación del usuario'
    );

    const reasons = workflow.quality?.partial_reasons || [];
    assert(reasons.includes('extraction_incomplete'), 'debe declararse como fallo de extracción');
    assert(
        !reasons.includes('missing_administrative_content'),
        'una sección perdida por recuperación no cuenta como documentación administrativa ausente'
    );
});

Deno.test('runValidation sigue acusando al documento cuando el mapa tampoco lo situaba', () => {
    // El bug espejo: si la sección de verdad no está en el expediente, el
    // consejo correcto SIGUE siendo completar la documentación.
    const consolidated = createConsolidatedResult();
    consolidated.result.criteriosAdjudicacion = {
        subjetivos: [],
        objetivos: [],
        umbralAnormalidad: tf(null, 'no_encontrado'),
    };

    const { workflow } = runValidation({
        consolidated,
        extraction: {
            sawRateLimit: false,
            degradedByRateLimit: false,
            degradedBlocks: [],
            emptyDespiteMapBlocks: [],
        },
    });

    assertEquals(workflow.quality?.section_diagnostics?.criteriosAdjudicacion?.code, 'missing_in_uploaded_docs');
    assert(!(workflow.quality?.partial_reasons || []).includes('extraction_incomplete'));
});
