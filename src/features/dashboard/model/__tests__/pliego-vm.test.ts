import { describe, it, expect } from 'vitest';
import { buildPliegoVM } from '../pliego-vm';
import { LicitacionData } from '../../../../types';
import { tf } from '../../../../test-utils/tracked-field-factory';

const noEncontrado = <T>(value: T) => ({ value, status: 'no_encontrado' as const });

const createEmptyLicitacionData = (): LicitacionData =>
    ({
        datosGenerales: {
            presupuesto: noEncontrado(0),
            plazoEjecucionMeses: noEncontrado(0),
            cpv: noEncontrado([] as string[]),
            organoContratacion: noEncontrado(''),
            titulo: noEncontrado(''),
            moneda: noEncontrado('EUR'),
        },
        criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
        requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [], profesional: [] },
        requisitosTecnicos: { funcionales: [], normativa: [] },
        restriccionesYRiesgos: { killCriteria: [], riesgos: [], penalizaciones: [] },
        modeloServicio: { sla: [], equipoMinimo: [] },
        metadata: { tags: [] },
    }) as unknown as LicitacionData;

describe('buildPliegoVM', () => {
    it('should handle partial data and use defaults', () => {
        const input = createEmptyLicitacionData();

        const vm = buildPliegoVM(input);

        // Display logic in buildPliegoVM converts empty/zero to "No detectado"
        expect(vm.display.titulo).toBe('No detectado');
        expect(vm.display.presupuesto).toBe('No detectado');
        // Warnings — TrackedField with status 'no_encontrado' generates warning
        expect(vm.warnings.some((w) => w.message.includes('titulo'))).toBe(true);
    });

    it('should correctly map valid data', () => {
        const input = createEmptyLicitacionData();
        input.datosGenerales = {
            titulo: tf('Test Licitacion'),
            presupuesto: tf(1000),
            moneda: tf('EUR'),
            plazoEjecucionMeses: tf(12),
            organoContratacion: tf('Test Org'),
            cpv: tf(['1234']),
        };
        (input as LicitacionData & { hash?: string }).hash = 'abc';

        const vm = buildPliegoVM(input);

        expect(vm.display.titulo).toBe('Test Licitacion');
        expect(vm.display.presupuesto).toContain('1000,00'); // Formatting might vary by locale
        expect(vm.hash).toBe('abc');
    });
});
