
import { describe, it, expect } from 'vitest';
import { LicitacionSchema } from '../schemas';

describe('Schema Robustness', () => {
    it('should handle partial null values in datosGenerales', () => {
        const input = {
            datosGenerales: {
                titulo: null, // Should default to 'Sin título'?
                presupuesto: null, // Should be 0
                moneda: null,
                organoContratacion: null
            }
        };
        // This will likely THROW if schema doesn't handle nulls for strings
        const result = LicitacionSchema.parse(input);
        expect(result.datosGenerales.titulo).toBe("Sin título");
        expect(result.datosGenerales.presupuesto).toBe(0); // RobustNumber default
        expect(result.datosGenerales.organoContratacion).toBe("Desconocido"); // RobustString default
    });

    it('should handle completely empty input', () => {
        const result = LicitacionSchema.parse({});
        expect(result.datosGenerales.titulo).toBe("Sin título");
        expect(result.datosGenerales.presupuesto).toBe(0);
        expect(result.requisitosTecnicos).toBeDefined(); // defaults
    });

    it('should handle nulls in nested Primitive fields (Numbers, Enums, Booleans)', () => {
        const input = {
            criteriosAdjudicacion: {
                subjetivos: [{ descripcion: "Test", ponderacion: null }]
            },
            restriccionesYRiesgos: {
                riesgos: [{
                    descripcion: "Riesgo 1",
                    impacto: null, // Enum
                    probabilidad: undefined // Enum optional
                }]
            },
            requisitosTecnicos: {
                funcionales: [{ requisito: "Req 1", obligatorio: null }] // Boolean
            }
        };
        const result = LicitacionSchema.parse(input);

        // RobustNumber
        expect(result.criteriosAdjudicacion.subjetivos[0].ponderacion).toBe(0);

        // RobustEnum
        expect(result.restriccionesYRiesgos.riesgos[0].impacto).toBe("MEDIO");

        // RobustBoolean
        // The union logic might need checking, but if handled by RobustBoolean:
        const funcReq = result.requisitosTecnicos.funcionales[0];
        // It matches the object branch of the union
        if ('obligatorio' in funcReq) {
            expect(funcReq.obligatorio).toBe(true); // Default is true logic? Re-check schema default
        }
    });
});
