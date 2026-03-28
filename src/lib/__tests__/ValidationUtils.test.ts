import { describe, it, expect } from 'vitest';
import { LicitacionSchema } from '../schemas';

describe('Detailed Schema Validation', () => {
    // TrackedField fields return { value, status } objects

    // Datos Generales - TrackedField fields
    it('validates titulo default', () => {
        const res = LicitacionSchema.parse({});
        expect(res.datosGenerales.titulo).toMatchObject({ value: 'Sin título' });
    });

    it('validates titulo provided', () => {
        const res = LicitacionSchema.parse({ datosGenerales: { titulo: 'X' } });
        expect(res.datosGenerales.titulo).toMatchObject({ value: 'X', status: 'extraido' });
    });

    it('validates presupuesto default', () => {
        const res = LicitacionSchema.parse({});
        expect(res.datosGenerales.presupuesto).toMatchObject({ value: 0 });
    });

    it('validates presupuesto number', () => {
        const res = LicitacionSchema.parse({ datosGenerales: { presupuesto: 500 } });
        expect(res.datosGenerales.presupuesto).toMatchObject({ value: 500, status: 'extraido' });
    });

    it('validates presupuesto null coercion', () => {
        const res = LicitacionSchema.parse({ datosGenerales: { presupuesto: null } });
        expect(res.datosGenerales.presupuesto).toMatchObject({ value: 0, status: 'no_encontrado' });
    });

    it('validates moneda default', () => {
        expect(LicitacionSchema.parse({}).datosGenerales.moneda).toMatchObject({ value: 'EUR' });
    });

    it('validates plazo default', () => {
        expect(LicitacionSchema.parse({}).datosGenerales.plazoEjecucionMeses).toMatchObject({ value: 0 });
    });

    it('validates plazo provided', () => {
        expect(
            LicitacionSchema.parse({ datosGenerales: { plazoEjecucionMeses: 10 } }).datosGenerales.plazoEjecucionMeses
        ).toMatchObject({ value: 10, status: 'extraido' });
    });

    it('validates cpv default', () => {
        expect(LicitacionSchema.parse({}).datosGenerales.cpv).toMatchObject({ value: [] });
    });

    it('validates cpv provided', () => {
        const result = LicitacionSchema.parse({ datosGenerales: { cpv: ['1', '2'] } });
        expect(result.datosGenerales.cpv.value).toHaveLength(2);
    });

    // Criterios
    it('validates subjetivos default', () => {
        expect(LicitacionSchema.parse({}).criteriosAdjudicacion.subjetivos).toEqual([]);
    });

    it('validates objetivos default', () => {
        expect(LicitacionSchema.parse({}).criteriosAdjudicacion.objetivos).toEqual([]);
    });

    it('validates subjetivo item', () => {
        const data = { criteriosAdjudicacion: { subjetivos: [{ descripcion: 'D', ponderacion: 10 }] } };
        const res = LicitacionSchema.parse(data);
        expect(res.criteriosAdjudicacion.subjetivos[0].descripcion).toBe('D');
        expect(res.criteriosAdjudicacion.subjetivos[0].ponderacion).toBe(10);
    });

    it('validates objetivo item', () => {
        const data = { criteriosAdjudicacion: { objetivos: [{ descripcion: 'O', ponderacion: 20 }] } };
        const res = LicitacionSchema.parse(data);
        expect(res.criteriosAdjudicacion.objetivos[0].ponderacion).toBe(20);
    });

    // Requisitos
    it('validates funcionales union string', () => {
        const data = { requisitosTecnicos: { funcionales: ['Req1'] } };
        const res = LicitacionSchema.parse(data);
        expect(res.requisitosTecnicos.funcionales[0]).toMatchObject({ requisito: 'Req1', obligatorio: true });
    });

    it('validates funcionales union object', () => {
        const data = { requisitosTecnicos: { funcionales: [{ requisito: 'Req2', obligatorio: false }] } };
        const res = LicitacionSchema.parse(data);
        expect(res.requisitosTecnicos.funcionales[0]).toMatchObject({ requisito: 'Req2', obligatorio: false });
    });

    it('validates normativa empty', () => {
        expect(LicitacionSchema.parse({}).requisitosTecnicos.normativa).toEqual([]);
    });

    // Solvencia
    it('validates solvencia economica defaults', () => {
        expect(LicitacionSchema.parse({}).requisitosSolvencia.economica.cifraNegocioAnualMinima).toBe(0);
    });

    it('validates solvencia tecnica defaults', () => {
        expect(LicitacionSchema.parse({}).requisitosSolvencia.tecnica).toEqual([]);
    });

    it('validates solvencia tecnica item', () => {
        const data = { requisitosSolvencia: { tecnica: [{ descripcion: 'Exp', proyectosSimilaresRequeridos: 2 }] } };
        const res = LicitacionSchema.parse(data);
        expect(res.requisitosSolvencia.tecnica[0].proyectosSimilaresRequeridos).toBe(2);
    });

    // Riesgos
    it('validates killCriteria default', () => {
        expect(LicitacionSchema.parse({}).restriccionesYRiesgos.killCriteria).toEqual([]);
    });

    it('validates riesgos default', () => {
        expect(LicitacionSchema.parse({}).restriccionesYRiesgos.riesgos).toEqual([]);
    });

    it('validates riesgo item logic', () => {
        const data = { restriccionesYRiesgos: { riesgos: [{ descripcion: 'R', impacto: 'ALTO' }] } };
        const res = LicitacionSchema.parse(data);
        expect(res.restriccionesYRiesgos.riesgos[0].impacto).toBe('ALTO');
    });

    // Modelo Servicio
    it('validates sla default', () => {
        expect(LicitacionSchema.parse({}).modeloServicio.sla).toEqual([]);
    });

    it('validates equipoMinimo default', () => {
        expect(LicitacionSchema.parse({}).modeloServicio.equipoMinimo).toEqual([]);
    });

    it('validates sla string transform', () => {
        const data = { modeloServicio: { sla: ['99%'] } };
        expect(LicitacionSchema.parse(data).modeloServicio.sla[0]).toMatchObject({ metrica: '99%' });
    });

    // Metadata
    it('validates metadata optionality', () => {
        expect(LicitacionSchema.parse({}).metadata).toBeUndefined();
    });

    it('validates metadata tags', () => {
        expect(LicitacionSchema.parse({ metadata: { tags: ['t'] } }).metadata?.tags).toContain('t');
    });

    it('validates metadata state enum', () => {
        expect(LicitacionSchema.parse({ metadata: { estado: 'ADJUDICADA' } }).metadata?.estado).toBe('ADJUDICADA');
    });

    it('rejects invalid metadata state', () => {
        expect(() => LicitacionSchema.parse({ metadata: { estado: 'INVALID' } })).toThrow();
    });
});
