import { describe, it, expect } from 'vitest';
import { QualityService } from '../quality.service';
import { LicitacionContent } from '../../types';
import { tf } from '../../test-utils/tracked-field-factory';

describe('QualityService', () => {
    const service = new QualityService();

    /** Base content where every critical section is fully populated */
    const baseContent: LicitacionContent = {
        datosGenerales: {
            titulo: tf('Contrato de servicios de limpieza'),
            presupuesto: tf(100000),
            moneda: tf('EUR'),
            plazoEjecucionMeses: tf(12),
            cpv: tf(['90910000']),
            organoContratacion: tf('Ayuntamiento de Madrid'),
        },
        criteriosAdjudicacion: {
            subjetivos: [{ descripcion: 'Metodología', ponderacion: 40, subcriterios: [], cita: '' }],
            objetivos: [{ descripcion: 'Precio', ponderacion: 60, cita: '' }],
        },
        requisitosTecnicos: {
            funcionales: [{ requisito: 'Experiencia mínima 3 años', obligatorio: true, cita: '' }],
            normativa: [{ norma: 'ISO 9001' }],
        },
        requisitosSolvencia: {
            economica: { cifraNegocioAnualMinima: 50000 },
            tecnica: [{ descripcion: 'Experiencia demostrable', proyectosSimilaresRequeridos: 1, cita: '' }],
            profesional: [],
        },
        restriccionesYRiesgos: {
            riesgos: [],
            killCriteria: [{ criterio: 'No estar al corriente de pagos', justificacion: '', cita: '' }],
            penalizaciones: [],
        },
        modeloServicio: { sla: [], equipoMinimo: [] },
    };

    describe('evaluateQuality — overall status', () => {
        it('returns COMPLETO when all critical sections are fully populated', () => {
            const report = service.evaluateQuality(baseContent);
            expect(report.overall).toBe('COMPLETO');
        });

        it('returns PARCIAL when all critical fields are missing (datosGenerales never fully VACIO)', () => {
            // NOTE: evaluateGenerales tracks total=4 but only increments missing for 3 fields
            // (titulo, presupuesto, organo) — plazo is commented out. So missing can be max 3,
            // never equalling total=4, so datosGenerales always returns PARCIAL when all are empty.
            // This means overall is always PARCIAL or COMPLETO, never VACIO via this path.
            const emptyContent: LicitacionContent = {
                datosGenerales: {
                    titulo: tf('Sin título'),
                    presupuesto: tf(0),
                    moneda: tf('EUR'),
                    plazoEjecucionMeses: tf(0),
                    cpv: tf([]),
                    organoContratacion: tf('Desconocido'),
                },
                criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
                requisitosTecnicos: { funcionales: [], normativa: [] },
                requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [], profesional: [] },
                restriccionesYRiesgos: { riesgos: [], killCriteria: [], penalizaciones: [] },
                modeloServicio: { sla: [], equipoMinimo: [] },
            };
            const report = service.evaluateQuality(emptyContent);
            // All 3 critical fields missing → PARCIAL (not VACIO, see evaluateGenerales implementation)
            expect(report.overall).toBe('PARCIAL');
            expect(report.missingCriticalFields.length).toBeGreaterThan(0);
        });

        it('returns PARCIAL when some sections are present and others empty', () => {
            const partialContent = {
                ...baseContent,
                criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
            };
            const report = service.evaluateQuality(partialContent);
            expect(report.overall).toBe('PARCIAL');
        });

        it('returns PARCIAL when missingCriticalFields has items', () => {
            const content = {
                ...baseContent,
                datosGenerales: {
                    ...baseContent.datosGenerales,
                    titulo: tf('Sin título'), // triggers missing
                },
            };
            const report = service.evaluateQuality(content);
            expect(report.overall).toBe('PARCIAL');
            expect(report.missingCriticalFields).toContain('datosGenerales.titulo');
        });
    });

    describe('evaluateQuality — missingCriticalFields', () => {
        it('tracks missing titulo when value is "Sin título"', () => {
            const content = {
                ...baseContent,
                datosGenerales: { ...baseContent.datosGenerales, titulo: tf('Sin título') },
            };
            const report = service.evaluateQuality(content);
            expect(report.missingCriticalFields).toContain('datosGenerales.titulo');
        });

        it('tracks missing titulo when value is "No detectado"', () => {
            const content = {
                ...baseContent,
                datosGenerales: { ...baseContent.datosGenerales, titulo: tf('No detectado') },
            };
            const report = service.evaluateQuality(content);
            expect(report.missingCriticalFields).toContain('datosGenerales.titulo');
        });

        it('tracks missing presupuesto when value is 0', () => {
            const content = {
                ...baseContent,
                datosGenerales: { ...baseContent.datosGenerales, presupuesto: tf(0) },
            };
            const report = service.evaluateQuality(content);
            expect(report.missingCriticalFields).toContain('datosGenerales.presupuesto');
        });

        it('tracks missing organoContratacion when value is "Desconocido"', () => {
            const content = {
                ...baseContent,
                datosGenerales: { ...baseContent.datosGenerales, organoContratacion: tf('Desconocido') },
            };
            const report = service.evaluateQuality(content);
            expect(report.missingCriticalFields).toContain('datosGenerales.organoContratacion');
        });

        it('does not add extra missing fields when all are present', () => {
            const report = service.evaluateQuality(baseContent);
            expect(report.missingCriticalFields).toHaveLength(0);
        });
    });

    describe('evaluateQuality — bySection', () => {
        it('marks criteriosAdjudicacion as COMPLETO when both subjetivos and objetivos are present', () => {
            const report = service.evaluateQuality(baseContent);
            expect(report.bySection['criteriosAdjudicacion']).toBe('COMPLETO');
        });

        it('marks criteriosAdjudicacion as PARCIAL when only one type is present', () => {
            const content = {
                ...baseContent,
                criteriosAdjudicacion: { subjetivos: baseContent.criteriosAdjudicacion.subjetivos, objetivos: [] },
            };
            const report = service.evaluateQuality(content);
            expect(report.bySection['criteriosAdjudicacion']).toBe('PARCIAL');
        });

        it('marks criteriosAdjudicacion as VACIO when both lists are empty', () => {
            const content = {
                ...baseContent,
                criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
            };
            const report = service.evaluateQuality(content);
            expect(report.bySection['criteriosAdjudicacion']).toBe('VACIO');
        });

        it('marks requisitosSolvencia as COMPLETO when both economica and tecnica present', () => {
            const report = service.evaluateQuality(baseContent);
            expect(report.bySection['requisitosSolvencia']).toBe('COMPLETO');
        });

        it('marks requisitosSolvencia as VACIO when cifraNegocioAnualMinima=0 and no tecnica', () => {
            const content = {
                ...baseContent,
                requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [], profesional: [] },
            };
            const report = service.evaluateQuality(content);
            expect(report.bySection['requisitosSolvencia']).toBe('VACIO');
        });

        it('marks requisitosTecnicos as VACIO when funcionales is empty', () => {
            const content = {
                ...baseContent,
                requisitosTecnicos: { funcionales: [], normativa: [] },
            };
            const report = service.evaluateQuality(content);
            expect(report.bySection['requisitosTecnicos']).toBe('VACIO');
        });

        it('marks requisitosTecnicos as PARCIAL when funcionales present but no normativa', () => {
            const content = {
                ...baseContent,
                requisitosTecnicos: { funcionales: baseContent.requisitosTecnicos.funcionales, normativa: [] },
            };
            const report = service.evaluateQuality(content);
            expect(report.bySection['requisitosTecnicos']).toBe('PARCIAL');
        });
    });

    describe('evaluateQuality — ambiguous_fields forwarding', () => {
        it('forwards existingAmbiguousFields to report', () => {
            const ambiguous = ['datosGenerales.cpv', 'economico.IVA'];
            const report = service.evaluateQuality(baseContent, ambiguous);
            expect(report.ambiguous_fields).toEqual(ambiguous);
        });

        it('returns empty array when no ambiguous fields provided', () => {
            const report = service.evaluateQuality(baseContent);
            expect(report.ambiguous_fields).toEqual([]);
        });
    });

    describe('evaluateQuality — consistency warnings', () => {
        it('warns on non-standard currency (not EUR/USD)', () => {
            const content = {
                ...baseContent,
                datosGenerales: { ...baseContent.datosGenerales, moneda: tf('GBP') },
            };
            const report = service.evaluateQuality(content);
            const hasWarning = report.consistencyWarnings?.some((w) => w.includes('no es estándar'));
            expect(hasWarning).toBe(true);
        });

        it('warns when plazoEjecucionMeses is 0', () => {
            const content = {
                ...baseContent,
                datosGenerales: { ...baseContent.datosGenerales, plazoEjecucionMeses: tf(0) },
            };
            const report = service.evaluateQuality(content);
            const hasWarning = report.consistencyWarnings?.some((w) => w.includes('0 meses'));
            expect(hasWarning).toBe(true);
        });

        it('warns when no criterios de adjudicacion detected', () => {
            const content = {
                ...baseContent,
                criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
            };
            const report = service.evaluateQuality(content);
            expect(report.warnings).toContain('No se detectaron criterios de adjudicación.');
        });

        it('does not emit consistency warnings for valid content', () => {
            const report = service.evaluateQuality(baseContent);
            expect(report.consistencyWarnings).toHaveLength(0);
        });
    });
});
