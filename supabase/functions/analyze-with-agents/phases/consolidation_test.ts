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
