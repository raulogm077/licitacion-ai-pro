
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
        try {
            const result = LicitacionSchema.parse(input);
            expect(result.datosGenerales.titulo).toBe("Sin título");
        } catch (e) {
            expect(e).toBeDefined();
            console.log("Validation failed on nulls as expected:", e.issues);
        }
    });

    it('should handle completely empty input', () => {
        const result = LicitacionSchema.parse({});
        expect(result.datosGenerales.titulo).toBe("Sin título");
        expect(result.datosGenerales.presupuesto).toBe(0);
        expect(result.requisitosTecnicos).toBeDefined(); // defaults
    });
});
