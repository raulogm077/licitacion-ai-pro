import { CanonicalResultSchema } from './canonical.ts';

Deno.test('CanonicalResultSchema normalizes malformed tracked numbers and null subcriterios', () => {
    const parsed = CanonicalResultSchema.parse({
        datosGenerales: {
            titulo: { value: 'Licitacion de prueba', status: 'extraido' },
            organoContratacion: { value: 'Organismo X', status: 'extraido' },
            presupuesto: { value: '100000', status: 'extraido' },
            moneda: { value: 'EUR', status: 'extraido' },
            plazoEjecucionMeses: { value: 'No especificado', status: 'ambiguo' },
            cpv: { value: ['12345678'], status: 'extraido' },
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
        !Array.isArray(parsed.criteriosAdjudicacion.subjetivos[0].subcriterios) ||
        parsed.criteriosAdjudicacion.subjetivos[0].subcriterios.length !== 0
    ) {
        throw new Error('Expected subjetivos[0].subcriterios to normalize to []');
    }
});
