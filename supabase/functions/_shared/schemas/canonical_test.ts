import { CanonicalResultSchema, WorkflowSchema } from './canonical.ts';

Deno.test('CanonicalResultSchema normalizes malformed tracked numbers and null subcriterios', () => {
    const parsed = CanonicalResultSchema.parse({
        datosGenerales: {
            titulo: { value: 'Licitacion de prueba', status: 'extraido' },
            organoContratacion: { value: 'Organismo X', status: 'extraido' },
            presupuesto: { value: '100000', status: 'extraido' },
            moneda: { value: 'EUR', status: 'extraido' },
            plazoEjecucionMeses: { value: 'No especificado', status: 'ambiguo' },
            cpv: { value: '12345678, 87654321', status: 'extraido' },
        },
        criteriosAdjudicacion: {
            subjetivos: [
                {
                    descripcion: 'Memoria tecnica',
                    ponderacion: 35,
                    subcriterios: null,
                },
            ],
            objetivos: [],
        },
    });

    if (parsed.datosGenerales.plazoEjecucionMeses.value !== 0) {
        throw new Error('Expected plazoEjecucionMeses.value to normalize to 0');
    }

    if (
        !Array.isArray(parsed.datosGenerales.cpv.value) ||
        parsed.datosGenerales.cpv.value.length !== 2 ||
        parsed.datosGenerales.cpv.value[0] !== '12345678' ||
        parsed.datosGenerales.cpv.value[1] !== '87654321'
    ) {
        throw new Error('Expected cpv.value to normalize to a string array');
    }

    if (
        !Array.isArray(parsed.criteriosAdjudicacion.subjetivos[0].subcriterios) ||
        parsed.criteriosAdjudicacion.subjetivos[0].subcriterios.length !== 0
    ) {
        throw new Error('Expected subjetivos[0].subcriterios to normalize to []');
    }
});

Deno.test('CanonicalResultSchema normalizes string subcriterios into structured items', () => {
    const parsed = CanonicalResultSchema.parse({
        datosGenerales: {
            titulo: { value: 'Licitacion de prueba', status: 'extraido' },
            organoContratacion: { value: 'Organismo X', status: 'extraido' },
            presupuesto: { value: 100000, status: 'extraido' },
            moneda: { value: 'EUR', status: 'extraido' },
            plazoEjecucionMeses: { value: 12, status: 'extraido' },
            cpv: { value: ['12345678'], status: 'extraido' },
        },
        criteriosAdjudicacion: {
            subjetivos: [
                {
                    descripcion: 'Memoria tecnica',
                    ponderacion: 35,
                    subcriterios: ['Calidad del equipo', { descripcion: 'Plan de transicion', ponderacion: '10' }],
                },
            ],
            objetivos: [],
        },
    });

    if (parsed.criteriosAdjudicacion.subjetivos[0].subcriterios.length !== 2) {
        throw new Error('Expected subjetivos[0].subcriterios to preserve recoverable entries');
    }

    if (parsed.criteriosAdjudicacion.subjetivos[0].subcriterios[0].descripcion !== 'Calidad del equipo') {
        throw new Error('Expected string subcriterios to normalize into descripcion');
    }

    if (parsed.criteriosAdjudicacion.subjetivos[0].subcriterios[0].ponderacion !== 0) {
        throw new Error('Expected string subcriterios to default ponderacion to 0');
    }
});

Deno.test('WorkflowSchema accepts structured partial reasons', () => {
    const parsed = WorkflowSchema.parse({
        status: 'completed',
        quality: {
            overall: 'PARCIAL',
            bySection: { datosGenerales: 'PARCIAL' },
            missingCriticalFields: ['datosGenerales.cpv'],
            ambiguous_fields: [],
            warnings: [],
            partial_reasons: ['document_insufficient', 'missing_administrative_content'],
            section_diagnostics: {
                datosGenerales: {
                    code: 'present',
                    message: 'Datos generales recuperados.',
                    evidenceCount: 3,
                },
            },
        },
        evidences: [],
        phases: {},
        updated_at: new Date().toISOString(),
    });

    if ((parsed.quality?.partial_reasons?.length || 0) !== 2) {
        throw new Error('Expected partial_reasons to be preserved in workflow quality');
    }

    if (parsed.quality?.section_diagnostics?.datosGenerales?.code !== 'present') {
        throw new Error('Expected section_diagnostics to be preserved in workflow quality');
    }
});

Deno.test('CanonicalResultSchema conserva el grounding de importes y ponderaciones', () => {
    // Contrato de la Guía §6.3 sobre los números que alimentan decisiones: PBL y
    // VEC (fórmula de precio, umbral de temeraria, VAM de solvencia), la
    // ponderación de cada criterio y el texto del umbral de anormalidad.
    const parsed = CanonicalResultSchema.parse({
        datosGenerales: {
            titulo: { value: 'Licitacion de prueba', status: 'extraido' },
            organoContratacion: { value: 'Organismo X', status: 'extraido' },
        },
        economico: {
            presupuestoBaseLicitacion: {
                value: 133200,
                evidence: { quote: 'PBL: 133.200 EUR (IVA excluido)', pageHint: '4' },
                status: 'extraido',
            },
            // Importe legacy sin envolver: se acepta y se marca extraido, pero
            // NO se le inventa evidencia.
            valorEstimadoContrato: 266400,
        },
        criteriosAdjudicacion: {
            subjetivos: [{ descripcion: 'Memoria tecnica', ponderacion: 35 }],
            objetivos: [
                {
                    descripcion: 'Precio',
                    ponderacion: { value: 40, evidence: { quote: 'Precio: hasta 40 puntos' }, status: 'extraido' },
                    formula: '40 x (oferta minima / oferta analizada)',
                },
            ],
            umbralAnormalidad: { value: 'Ofertas un 25% por debajo del PBL', status: 'ambiguo' },
        },
    });

    const pbl = parsed.economico.presupuestoBaseLicitacion;
    if (pbl.value !== 133200 || pbl.evidence?.pageHint !== '4') {
        throw new Error('Expected presupuestoBaseLicitacion to keep value and evidence');
    }

    const vec = parsed.economico.valorEstimadoContrato;
    if (vec.value !== 266400 || vec.status !== 'extraido' || vec.evidence !== undefined) {
        throw new Error('Expected a legacy plain amount to wrap without fabricating evidence');
    }

    if (parsed.criteriosAdjudicacion.subjetivos[0].ponderacion.value !== 35) {
        throw new Error('Expected a legacy plain ponderacion to wrap to its value');
    }

    const precio = parsed.criteriosAdjudicacion.objetivos[0];
    if (precio.ponderacion.value !== 40 || precio.ponderacion.evidence?.quote !== 'Precio: hasta 40 puntos') {
        throw new Error('Expected ponderacion evidence to survive parsing');
    }
    if (precio.formula !== '40 x (oferta minima / oferta analizada)') {
        throw new Error('Expected the rest of the criterion to stay flat');
    }

    // Antes se normalizaba con safeCoerceString, que desenvolvía el objeto y
    // tiraba el status: un umbral dudoso llegaba a la UI como uno firme.
    const umbral = parsed.criteriosAdjudicacion.umbralAnormalidad;
    if (umbral.value !== 'Ofertas un 25% por debajo del PBL' || umbral.status !== 'ambiguo') {
        throw new Error('Expected umbralAnormalidad to keep its ambiguous status');
    }
});

Deno.test('CanonicalResultSchema marca no_encontrado los importes ausentes', () => {
    const parsed = CanonicalResultSchema.parse({
        datosGenerales: {
            titulo: { value: 'Licitacion de prueba', status: 'extraido' },
            organoContratacion: { value: 'Organismo X', status: 'extraido' },
        },
    });

    if (parsed.economico.presupuestoBaseLicitacion.status !== 'no_encontrado') {
        throw new Error('Expected a missing PBL to be no_encontrado, not a silent 0');
    }
    if (parsed.criteriosAdjudicacion.umbralAnormalidad.status !== 'no_encontrado') {
        throw new Error('Expected a missing umbralAnormalidad to be no_encontrado');
    }
});
