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

    it('prioritizes document-composition guidance over the OCR reason when both are present', () => {
        // Prod incident 2026-07-12: a memo analyzed under rate limit reported both
        // missing_administrative_content and ocr_or_indexing_low_signal; the useful
        // advice is "complete the expediente", not "re-scan a healthy PDF".
        const input = createEmptyLicitacionData();
        input.workflow = {
            status: 'completed',
            steps: [],
            evidences: [],
            phases: {},
            created_at: '2026-07-12T00:00:00.000Z',
            updated_at: '2026-07-12T00:00:00.000Z',
            quality: {
                overall: 'PARCIAL',
                bySection: {
                    datosGenerales: 'VACIO',
                    criteriosAdjudicacion: 'VACIO',
                    requisitosSolvencia: 'PARCIAL',
                    requisitosTecnicos: 'COMPLETO',
                    restriccionesYRiesgos: 'COMPLETO',
                    modeloServicio: 'COMPLETO',
                },
                missingCriticalFields: [],
                ambiguous_fields: [],
                warnings: [],
                partial_reasons: ['ocr_or_indexing_low_signal', 'missing_administrative_content'],
                section_diagnostics: {},
            },
        } as LicitacionData['workflow'];

        const vm = buildPliegoVM(input);

        expect(vm.guidance?.title).toContain('sin cobertura administrativa');
        expect(vm.guidance?.nextStep).toContain('PCAP');
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

/** Construye un `workflow.quality` completo variando solo lo que interesa al caso. */
const withQuality = (input: LicitacionData, quality: Partial<Record<string, unknown>>): LicitacionData => {
    input.workflow = {
        status: 'completed',
        steps: [],
        evidences: [],
        phases: {},
        created_at: '2026-07-26T00:00:00.000Z',
        updated_at: '2026-07-26T00:00:00.000Z',
        quality: {
            overall: 'PARCIAL',
            bySection: {
                datosGenerales: 'PARCIAL',
                criteriosAdjudicacion: 'PARCIAL',
                requisitosSolvencia: 'PARCIAL',
                requisitosTecnicos: 'PARCIAL',
                restriccionesYRiesgos: 'PARCIAL',
                modeloServicio: 'PARCIAL',
            },
            missingCriticalFields: [],
            ambiguous_fields: [],
            warnings: [],
            partial_reasons: [],
            section_diagnostics: {},
            ...quality,
        },
    } as LicitacionData['workflow'];
    return input;
};

describe('buildPliegoVM — guidance por motivo de parcialidad', () => {
    it('celebra la cobertura alta cuando la calidad global es COMPLETO', () => {
        const vm = buildPliegoVM(withQuality(createEmptyLicitacionData(), { overall: 'COMPLETO' }));

        expect(vm.guidance?.title).toContain('cobertura alta');
        expect(vm.guidance?.tone).toBe('success');
        expect(vm.isIncomplete).toBe(false);
    });

    it('aconseja mejorar el OCR cuando la señal del PDF es baja', () => {
        const vm = buildPliegoVM(
            withQuality(createEmptyLicitacionData(), { partial_reasons: ['ocr_or_indexing_low_signal'] })
        );

        expect(vm.guidance?.title).toContain('señal baja');
        expect(vm.guidance?.nextStep).toContain('OCR');
    });

    it('pide el expediente completo cuando el documento es insuficiente', () => {
        const vm = buildPliegoVM(
            withQuality(createEmptyLicitacionData(), { partial_reasons: ['document_insufficient'] })
        );

        expect(vm.guidance?.title).toContain('Expediente parcial');
    });

    it('trata cuatro o más campos críticos ausentes como expediente parcial, aunque no haya motivo declarado', () => {
        const vm = buildPliegoVM(
            withQuality(createEmptyLicitacionData(), {
                missingCriticalFields: [
                    'datosGenerales.presupuesto',
                    'datosGenerales.plazoEjecucionMeses',
                    'datosGenerales.cpv',
                    'datosGenerales.organoContratacion',
                ],
            })
        );

        expect(vm.guidance?.title).toContain('Expediente parcial');
    });

    it('avisa de degradación cuando el proveedor de IA limitó el ritmo', () => {
        const vm = buildPliegoVM(
            withQuality(createEmptyLicitacionData(), { partial_reasons: ['rate_limited_degraded'] })
        );

        expect(vm.guidance?.title).toContain('saturación temporal');
        expect(vm.guidance?.nextStep).toContain('PARCIAL');
    });

    it('cae al consejo genérico cuando no hay motivo ni campos críticos suficientes', () => {
        const vm = buildPliegoVM(withQuality(createEmptyLicitacionData(), {}));

        expect(vm.guidance?.title).toBe('Análisis parcial pero utilizable');
        expect(vm.guidance?.tone).toBe('info');
    });

    it('deduce la falta de cobertura técnica desde el texto de los avisos, sin partial_reasons', () => {
        // El backend no siempre emite partial_reasons; el texto del aviso es la señal de respaldo.
        const vm = buildPliegoVM(
            withQuality(createEmptyLicitacionData(), {
                warnings: ['El análisis se limitó únicamente al PCAP aportado.'],
            })
        );

        expect(vm.guidance?.title).toContain('sin cobertura técnica');
    });
});

describe('buildPliegoVM — mensajes de capítulo vacío según diagnóstico', () => {
    const diagnosticFor = (code: string) =>
        withQuality(createEmptyLicitacionData(), {
            section_diagnostics: {
                modeloServicio: { code, message: 'mensaje del backend', evidenceCount: 1 },
            },
        });

    it('explica que la extracción quedó degradada cuando hay evidencia pero hueco de extracción', () => {
        const vm = buildPliegoVM(diagnosticFor('extraction_gap'));
        const servicio = vm.chapters.find((c) => c.id === 'servicio');

        expect(servicio?.emptyMessage?.text).toContain('evidencia útil');
    });

    it('usa el mensaje por defecto ante un código de diagnóstico desconocido', () => {
        const vm = buildPliegoVM(diagnosticFor('codigo_no_previsto'));
        const servicio = vm.chapters.find((c) => c.id === 'servicio');

        expect(servicio?.emptyMessage?.text).toContain('niveles de servicio');
    });
});

describe('buildPliegoVM — evidencias, ambigüedad y citas', () => {
    it('indexa las evidencias del workflow y las expone por fieldPath', () => {
        const input = withQuality(createEmptyLicitacionData(), {});
        // `evidences` no forma parte del tipo declarado de workflow; el runtime sí
        // lo consume, así que se asigna con un cast explícito.
        (input.workflow as unknown as { evidences: unknown[] }).evidences = [
            { fieldPath: 'datosGenerales.presupuesto', quote: 'importe de 1.000 €', pageHint: 'pág. 4' },
            // Sin quote: debe descartarse en vez de indexar una entrada vacía.
            { fieldPath: 'datosGenerales.cpv', quote: '' },
        ];

        const vm = buildPliegoVM(input);

        expect(vm.getEvidence('datosGenerales.presupuesto')).toEqual({
            quote: 'importe de 1.000 €',
            pageHint: 'pág. 4',
        });
        expect(vm.getEvidence('datosGenerales.cpv')).toBeUndefined();
    });

    it('indexa también la evidencia embebida en un TrackedField', () => {
        const input = createEmptyLicitacionData();
        input.datosGenerales.organoContratacion = {
            value: 'Ayuntamiento',
            status: 'extraido',
            evidence: { quote: 'Órgano de contratación: Ayuntamiento', pageHint: 'pág. 1' },
        } as unknown as LicitacionData['datosGenerales']['organoContratacion'];

        const vm = buildPliegoVM(input);

        expect(vm.getEvidence('datosGenerales.organoContratacion')?.quote).toContain('Ayuntamiento');
    });

    it('marca como ambiguo un TrackedField con status ambiguo y emite el aviso correspondiente', () => {
        const input = createEmptyLicitacionData();
        input.datosGenerales.presupuesto = {
            value: 1000,
            status: 'ambiguo',
        } as unknown as LicitacionData['datosGenerales']['presupuesto'];

        const vm = buildPliegoVM(input);

        expect(vm.isAmbiguous('datosGenerales.presupuesto')).toBe(true);
        expect(vm.warnings.some((w) => w.title === 'Dato ambiguo' && w.message.includes('presupuesto'))).toBe(true);
    });

    it('recoge las citas largas del contenido e ignora las triviales', () => {
        const input = createEmptyLicitacionData();
        input.criteriosAdjudicacion.objetivos = [
            { nombre: 'Precio', puntuacion: 40, cita: 'La puntuación por precio será de 40 puntos' },
            { nombre: 'Plazo', puntuacion: 10, cita: 'corta' },
        ] as unknown as LicitacionData['criteriosAdjudicacion']['objetivos'];

        const vm = buildPliegoVM(input);

        expect(vm.citations.some((c) => c.text.includes('40 puntos') && c.section === 'Criterios')).toBe(true);
        expect(vm.citations.some((c) => c.text === 'corta')).toBe(false);
    });

    it('propaga las inconsistencias semánticas como avisos', () => {
        const vm = buildPliegoVM(
            withQuality(createEmptyLicitacionData(), {
                consistencyWarnings: ['La suma de criterios no llega a 100 puntos'],
            })
        );

        expect(vm.warnings.some((w) => w.title === 'Inconsistencia Semántica')).toBe(true);
    });
});

describe('buildPliegoVM — normalización de display y recuentos', () => {
    it.each([
        ['Desconocido', 'No detectado'],
        ['Error al extraer el órgano', 'No detectado'],
        ['Diputación de Sevilla', 'Diputación de Sevilla'],
    ])('normaliza el órgano de contratación %s → %s', (raw, expected) => {
        const input = createEmptyLicitacionData();
        input.datosGenerales.organoContratacion = tf(raw);

        expect(buildPliegoVM(input).display.organo).toBe(expected);
    });

    it('trata el título placeholder como no detectado y aplica EUR por defecto', () => {
        const input = createEmptyLicitacionData();
        input.datosGenerales.titulo = tf('Sin título');
        input.datosGenerales.moneda = tf('');

        const vm = buildPliegoVM(input);

        expect(vm.display.titulo).toBe('No detectado');
        expect(vm.display.moneda).toBe('EUR');
    });

    it('cuenta riesgos, criterios excluyentes, criterios y requerimientos', () => {
        const input = createEmptyLicitacionData();
        input.restriccionesYRiesgos = {
            riesgos: [{ descripcion: 'r1' }, { descripcion: 'r2' }],
            // killCriteria expone `criterio`, no `descripcion`: quality.service lo
            // normaliza a string para detectar duplicados.
            killCriteria: [{ criterio: 'k1' }],
            penalizaciones: [{ concepto: 'p1' }],
        } as unknown as LicitacionData['restriccionesYRiesgos'];
        input.criteriosAdjudicacion = {
            objetivos: [{ nombre: 'o1' }],
            subjetivos: [{ nombre: 's1' }, { nombre: 's2' }],
        } as unknown as LicitacionData['criteriosAdjudicacion'];
        input.requisitosTecnicos = {
            funcionales: [{ descripcion: 'f1' }],
            normativa: [{ descripcion: 'n1' }, { descripcion: 'n2' }],
        } as unknown as LicitacionData['requisitosTecnicos'];

        const vm = buildPliegoVM(input);

        expect(vm.counts).toEqual({ riesgos: 4, killCriteria: 1, criterios: 3, requerimientos: 3 });
    });

    it('marca riesgos y servicio como COMPLETO cuando hay contenido y el backend no informa bySection', () => {
        const input = createEmptyLicitacionData();
        input.restriccionesYRiesgos.riesgos = [{ descripcion: 'riesgo' }] as unknown as never;
        input.modeloServicio.sla = [{ descripcion: 'sla' }] as unknown as never;

        const vm = buildPliegoVM(input);

        expect(vm.chapters.find((c) => c.id === 'riesgos')?.status).toBe('COMPLETO');
        expect(vm.chapters.find((c) => c.id === 'servicio')?.status).toBe('COMPLETO');
    });
});

describe('buildPliegoVM — formas alternativas de entrada', () => {
    it('acepta el contenido anidado bajo result y el workflow embebido en él', () => {
        const content = createEmptyLicitacionData();
        (content as unknown as Record<string, unknown>).workflow = {
            quality: {
                overall: 'PARCIAL',
                bySection: {},
                missingCriticalFields: [],
                ambiguous_fields: ['datosGenerales.cpv'],
                warnings: [],
                partial_reasons: ['rate_limited_degraded'],
                section_diagnostics: {},
            },
            evidences: [{ fieldPath: 'datosGenerales.titulo', quote: 'título del expediente' }],
        };
        const data = { result: content, notas: undefined } as unknown as LicitacionData;

        const vm = buildPliegoVM(data);

        expect(vm.guidance?.title).toContain('saturación temporal');
        expect(vm.isAmbiguous('datosGenerales.cpv')).toBe(true);
        expect(vm.getEvidence('datosGenerales.titulo')?.quote).toBe('título del expediente');
        expect(vm.notas).toEqual([]);
        expect(vm.id).toBe('unknown');
    });

    it('añade el capítulo de plantilla personalizada y deja de considerar vacío el análisis', () => {
        const input = createEmptyLicitacionData();
        (input as unknown as Record<string, unknown>).plantilla_personalizada = { campoLibre: 'valor' };

        const vm = buildPliegoVM(input);

        expect(vm.chapters[0]).toMatchObject({ id: 'plantilla', status: 'COMPLETO' });
        expect(vm.isAnalysisEmpty).toBe(false);
    });
});
