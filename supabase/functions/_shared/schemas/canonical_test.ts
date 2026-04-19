import { CanonicalResultSchema } from './canonical.ts';

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
