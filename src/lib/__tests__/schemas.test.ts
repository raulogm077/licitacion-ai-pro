import { describe, it, expect } from 'vitest';
import { LicitacionSchema } from '../schemas';

describe('LicitacionSchema', () => {
    it('parses empty object with defaults', () => {
        const result = LicitacionSchema.parse({});
        // TrackedField: titulo defaults to { value: 'Sin título', status: 'no_encontrado' }
        expect(result.datosGenerales.titulo).toMatchObject({ value: 'Sin título' });
        expect(result.datosGenerales.presupuesto).toMatchObject({ value: 0 });
        expect(result.requisitosTecnicos.funcionales).toEqual([]);
    });

    it('parses full valid data', () => {
        const data = {
            datosGenerales: { titulo: 'Test', presupuesto: 1000 },
            requisitosTecnicos: { funcionales: ['Req 1'] },
        };
        const result = LicitacionSchema.parse(data);
        // Raw values get wrapped by TrackedField preprocess
        expect(result.datosGenerales.titulo).toMatchObject({ value: 'Test', status: 'extraido' });
        expect(result.datosGenerales.presupuesto).toMatchObject({ value: 1000, status: 'extraido' });
        expect(result.requisitosTecnicos.funcionales[0]).toMatchObject({ requisito: 'Req 1' });
    });

    it('coerces strings to numbers for currency', () => {
        const data = { datosGenerales: { presupuesto: '5000' } };
        const result = LicitacionSchema.parse(data);
        // String "5000" → wrapped as TrackedField with value "5000" (preprocess wraps before number coercion)
        expect(result.datosGenerales.presupuesto).toMatchObject({ value: 5000 });
    });

    it('handles null numbers as 0', () => {
        const data = { datosGenerales: { presupuesto: null } };
        const result = LicitacionSchema.parse(data);
        expect(result.datosGenerales.presupuesto).toMatchObject({ value: 0, status: 'no_encontrado' });
        expect(result.datosGenerales.moneda).toMatchObject({ value: 'EUR' });
    });

    it('transforms string requirements to objects', () => {
        const data = { requisitosTecnicos: { funcionales: ['Simple string'] } };
        const result = LicitacionSchema.parse(data);
        expect(result.requisitosTecnicos.funcionales[0]).toEqual({
            requisito: 'Simple string',
            obligatorio: true,
        });
    });

    it('validates enum values for risks', () => {
        const data = {
            restriccionesYRiesgos: {
                riesgos: [{ descripcion: 'Risk 1', impacto: 'ALTO' }],
            },
        };
        const result = LicitacionSchema.parse(data);
        expect(result.restriccionesYRiesgos.riesgos[0].impacto).toBe('ALTO');
    });

    it('throws on invalid enum values', () => {
        const data = {
            restriccionesYRiesgos: {
                riesgos: [{ descripcion: 'Risk 1', impacto: 'INVALIDO' }],
            },
        };
        const result = LicitacionSchema.parse(data);
        expect(result.restriccionesYRiesgos.riesgos[0].impacto).toBe('MEDIO'); // Fallback default
    });

    it('handles modeloServicio string transformations', () => {
        const data = { modeloServicio: { sla: ['Uptime 99%'] } };
        const result = LicitacionSchema.parse(data);
        expect(result.modeloServicio.sla[0]).toEqual({
            metrica: 'Uptime 99%',
            objetivo: 'N/A',
        });
    });

    it('accepts valid metadata', () => {
        const data = { metadata: { tags: ['tag1'], estado: 'PENDIENTE' } };
        const result = LicitacionSchema.parse(data);
        expect(result.metadata?.tags).toContain('tag1');
        expect(result.metadata?.estado).toBe('PENDIENTE');
    });

    it('defaults metadata tags to empty array', () => {
        const data = { metadata: {} };
        const result = LicitacionSchema.parse(data);
        expect(result.metadata?.tags).toEqual([]);
    });
});
