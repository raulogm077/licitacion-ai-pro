import { describe, it, expect } from 'vitest';
import { LicitacionSchema } from '../schemas';

describe('Schema Robustness', () => {
    it('should handle partial null values in datosGenerales', () => {
        const input = {
            datosGenerales: {
                titulo: null,
                presupuesto: null,
                moneda: null,
                organoContratacion: null,
            },
        };
        const result = LicitacionSchema.parse(input);
        // TrackedField wraps null → { value: default, status: 'no_encontrado' }
        expect(result.datosGenerales.titulo).toMatchObject({ value: 'Sin título', status: 'no_encontrado' });
        expect(result.datosGenerales.presupuesto).toMatchObject({ value: 0, status: 'no_encontrado' });
        expect(result.datosGenerales.organoContratacion).toMatchObject({
            value: 'Desconocido',
            status: 'no_encontrado',
        });
    });

    it('should handle completely empty input', () => {
        const result = LicitacionSchema.parse({});
        expect(result.datosGenerales.titulo).toMatchObject({ value: 'Sin título' });
        expect(result.datosGenerales.presupuesto).toMatchObject({ value: 0 });
        expect(result.requisitosTecnicos).toBeDefined();
    });

    it('should handle nulls in nested Primitive fields (Numbers, Enums, Booleans)', () => {
        const input = {
            criteriosAdjudicacion: {
                subjetivos: [{ descripcion: 'Test', ponderacion: null }],
            },
            restriccionesYRiesgos: {
                riesgos: [
                    {
                        descripcion: 'Riesgo 1',
                        impacto: null,
                        probabilidad: undefined,
                    },
                ],
            },
            requisitosTecnicos: {
                funcionales: [{ requisito: 'Req 1', obligatorio: null }],
            },
        };
        const result = LicitacionSchema.parse(input);

        // RobustNumber
        expect(result.criteriosAdjudicacion.subjetivos[0].ponderacion).toBe(0);

        // RobustEnum
        expect(result.restriccionesYRiesgos.riesgos[0].impacto).toBe('MEDIO');

        // RobustBoolean
        const funcReq = result.requisitosTecnicos.funcionales[0];
        if ('obligatorio' in funcReq) {
            expect(funcReq.obligatorio).toBe(true);
        }
    });
});
