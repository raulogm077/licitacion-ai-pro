import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { runConsolidation } from './consolidation.ts';

Deno.test('runConsolidation preserves valid sections when datosGenerales has malformed evidence', () => {
    const result = runConsolidation({
        blocks: [
            {
                blockName: 'datosGenerales',
                data: {
                    titulo: { value: 'Contrato de prueba', status: 'extraido', evidence: null },
                    organoContratacion: { value: 'Ayuntamiento', status: 'extraido' },
                    presupuesto: { value: 1000, status: 'extraido' },
                    moneda: { value: 'EUR', status: 'extraido' },
                    plazoEjecucionMeses: { value: 12, status: 'extraido' },
                    cpv: { value: ['12345678'], status: 'extraido' },
                },
                evidences: [],
                warnings: [],
                ambiguous_fields: [],
            },
            {
                blockName: 'requisitosTecnicos',
                data: {
                    funcionales: [{ requisito: 'Debe incluir mantenimiento 24x7', obligatorio: true }],
                    normativa: [{ norma: 'ISO 9001' }],
                },
                evidences: [],
                warnings: [],
                ambiguous_fields: [],
            },
        ],
    });

    assertEquals(result.result.datosGenerales.titulo.value, 'Contrato de prueba');
    assertEquals(result.result.requisitosTecnicos.funcionales.length, 1);
    assertEquals(result.result.requisitosTecnicos.normativa.length, 1);
});

Deno.test('runConsolidation backfills datosGenerales budget and duration from economic sections without overwriting direct values', () => {
    const result = runConsolidation({
        blocks: [
            {
                blockName: 'datosGenerales',
                data: {
                    titulo: { value: 'Contrato de soporte', status: 'extraido' },
                    organoContratacion: { value: 'Entidad pública', status: 'extraido' },
                    presupuesto: { value: 0, status: 'no_encontrado' },
                    moneda: { value: 'EUR', status: 'extraido' },
                    plazoEjecucionMeses: { value: 0, status: 'no_encontrado' },
                    cpv: { value: ['72000000-5'], status: 'extraido' },
                },
                evidences: [],
                warnings: [],
                ambiguous_fields: [],
            },
            {
                blockName: 'economico',
                data: {
                    presupuestoBaseLicitacion: 8587086,
                    valorEstimadoContrato: 9000000,
                    moneda: 'EUR',
                },
                evidences: [],
                warnings: [],
                ambiguous_fields: [],
            },
            {
                blockName: 'duracionYProrrogas',
                data: {
                    duracionMeses: 60,
                },
                evidences: [],
                warnings: [],
                ambiguous_fields: [],
            },
        ],
    });

    assertEquals(result.result.datosGenerales.presupuesto.value, 8587086);
    assertEquals(result.result.datosGenerales.plazoEjecucionMeses.value, 60);
});

Deno.test('runConsolidation preserves criteriosAdjudicacion when subcriterios arrive as strings', () => {
    const result = runConsolidation({
        blocks: [
            {
                blockName: 'datosGenerales',
                data: {
                    titulo: { value: 'Contrato de soporte', status: 'extraido' },
                    organoContratacion: { value: 'Entidad pública', status: 'extraido' },
                    presupuesto: { value: 100000, status: 'extraido' },
                    moneda: { value: 'EUR', status: 'extraido' },
                    plazoEjecucionMeses: { value: 12, status: 'extraido' },
                    cpv: { value: ['72000000-5'], status: 'extraido' },
                },
                evidences: [],
                warnings: [],
                ambiguous_fields: [],
            },
            {
                blockName: 'criteriosAdjudicacion',
                data: {
                    subjetivos: [
                        {
                            descripcion: 'Memoria tecnica',
                            ponderacion: 45,
                            subcriterios: ['Calidad del equipo', 'Plan de transicion'],
                        },
                    ],
                    objetivos: [{ descripcion: 'Oferta economica', ponderacion: 55 }],
                },
                evidences: [],
                warnings: [],
                ambiguous_fields: [],
            },
        ],
    });

    assertEquals(result.result.criteriosAdjudicacion.subjetivos.length, 1);
    assertEquals(result.result.criteriosAdjudicacion.objetivos.length, 1);
    assertEquals(result.result.criteriosAdjudicacion.subjetivos[0].subcriterios.length, 2);
    assertEquals(result.result.criteriosAdjudicacion.subjetivos[0].subcriterios[0].descripcion, 'Calidad del equipo');
});
