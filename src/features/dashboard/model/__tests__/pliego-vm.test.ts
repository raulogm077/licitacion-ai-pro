import { describe, it, expect } from 'vitest';
import { buildPliegoVM } from '../pliego-vm';
import { LicitacionData } from '../../../../types';

const createEmptyLicitacionData = (): LicitacionData => ({
    datosGenerales: {
        presupuesto: 0,
        plazoEjecucionMeses: 0,
        cpv: [],
        organoContratacion: '',
        titulo: '',
        moneda: 'EUR'
    },
    criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
    requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [] },
    requisitosTecnicos: { funcionales: [], normativa: [] },
    restriccionesYRiesgos: { killCriteria: [], riesgos: [], penalizaciones: [] },
    modeloServicio: { sla: [], equipoMinimo: [] },
    metadata: { tags: [] }
} as unknown as LicitacionData);

describe('buildPliegoVM', () => {
    it('should handle partial data and use defaults', () => {
        const input = createEmptyLicitacionData();
        // Override with specific empty values to test defaults
        input.datosGenerales.titulo = '';

        const vm = buildPliegoVM(input);

        // Check defaults
        expect(vm.result.datosGenerales.titulo).toBe('');
        // Display logic in buildPliegoVM converts empty/zero to "No detectado"
        expect(vm.display.titulo).toBe('No detectado');
        expect(vm.display.presupuesto).toBe('No detectado');
        // Warnings
        expect(vm.warnings.some(w => w.message.includes('No se detectó el título'))).toBe(true);
    });

    it('should correctly map valid data', () => {
        const input = createEmptyLicitacionData();
        input.datosGenerales = {
            titulo: 'Test Licitacion',
            presupuesto: 1000,
            moneda: 'EUR',
            plazoEjecucionMeses: 12,
            organoContratacion: 'Test Org',
            cpv: ['1234']
        };
        (input as LicitacionData & { hash?: string }).hash = 'abc';

        const vm = buildPliegoVM(input);

        expect(vm.result.datosGenerales.titulo).toBe('Test Licitacion');
        expect(vm.display.titulo).toBe('Test Licitacion');
        expect(vm.display.presupuesto).toContain('1000,00'); // Formatting might vary by locale
        expect(vm.hash).toBe('abc');
    });
});
