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
        expect(vm.isIncomplete).toBe(true);
        expect(vm.guidance?.title).toBeTruthy();
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

    it('should prefer backend partial reasons to build guidance', () => {
        const input = createEmptyLicitacionData();
        input.datosGenerales = {
            titulo: tf('Expediente administrativo'),
            presupuesto: tf(1000),
            moneda: tf('EUR'),
            plazoEjecucionMeses: tf(12),
            organoContratacion: tf('Entidad'),
            cpv: tf(['1234']),
        };
        input.workflow = {
            status: 'completed',
            steps: [],
            evidences: [],
            phases: {},
            created_at: '2026-04-20T00:00:00.000Z',
            updated_at: '2026-04-20T00:00:00.000Z',
            quality: {
                overall: 'PARCIAL',
                bySection: {
                    datosGenerales: 'COMPLETO',
                    criteriosAdjudicacion: 'PARCIAL',
                    requisitosSolvencia: 'PARCIAL',
                    requisitosTecnicos: 'VACIO',
                    restriccionesYRiesgos: 'VACIO',
                    modeloServicio: 'VACIO',
                },
                missingCriticalFields: [],
                ambiguous_fields: [],
                warnings: [],
                partial_reasons: ['missing_technical_content'],
                section_diagnostics: {},
            },
        } as LicitacionData['workflow'];

        const vm = buildPliegoVM(input);

        expect(vm.quality.partialReasons).toContain('missing_technical_content');
        expect(vm.guidance?.title).toContain('administrativo sin cobertura técnica');
        expect(vm.chapters.find((chapter) => chapter.id === 'tecnicos')?.status).toBe('VACIO');
    });

    it('should expose section diagnostics and tailor empty chapter messaging from backend diagnostics', () => {
        const input = createEmptyLicitacionData();
        input.datosGenerales = {
            titulo: tf('Expediente administrativo'),
            presupuesto: tf(8587086),
            moneda: tf('EUR'),
            plazoEjecucionMeses: tf(60),
            organoContratacion: tf('AENA'),
            cpv: noEncontrado([] as string[]),
        };
        input.workflow = {
            status: 'completed',
            steps: [],
            evidences: [],
            phases: {},
            created_at: '2026-04-20T00:00:00.000Z',
            updated_at: '2026-04-20T00:00:00.000Z',
            quality: {
                overall: 'PARCIAL',
                bySection: {
                    datosGenerales: 'PARCIAL',
                    criteriosAdjudicacion: 'PARCIAL',
                    requisitosSolvencia: 'VACIO',
                    requisitosTecnicos: 'VACIO',
                    restriccionesYRiesgos: 'VACIO',
                    modeloServicio: 'VACIO',
                },
                missingCriticalFields: ['datosGenerales.cpv'],
                ambiguous_fields: [],
                warnings: [],
                partial_reasons: ['missing_technical_content'],
                section_diagnostics: {
                    requisitosSolvencia: {
                        code: 'missing_in_uploaded_docs',
                        message: 'La solvencia no aparece en los documentos subidos.',
                        evidenceCount: 0,
                    },
                    criteriosAdjudicacion: {
                        code: 'schema_recovered',
                        message: 'Se conservaron criterios útiles tras recuperar un bloque mal tipado.',
                        evidenceCount: 3,
                    },
                },
            },
        } as LicitacionData['workflow'];

        const vm = buildPliegoVM(input);
        const solvenciaChapter = vm.chapters.find((chapter) => chapter.id === 'solvencia');
        const criteriosChapter = vm.chapters.find((chapter) => chapter.id === 'criterios');

        expect(vm.display.presupuesto).not.toBe('No detectado');
        expect(vm.quality.sectionDiagnostics.requisitosSolvencia?.code).toBe('missing_in_uploaded_docs');
        expect(solvenciaChapter?.emptyMessage?.text).toContain('documentos subidos');
        expect(criteriosChapter?.emptyMessage?.text).toContain('recuperó parcialmente');
    });
});
