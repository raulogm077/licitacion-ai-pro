import { describe, it, expect } from 'vitest';
import { QualityService } from '../quality.service';
import { LicitacionContent } from '../../types';

describe('QualityService - Semantic Consistency', () => {
    const service = new QualityService();
    const baseContent: LicitacionContent = {
        datosGenerales: {
            titulo: 'Test',
            presupuesto: 1000,
            moneda: 'EUR',
            plazoEjecucionMeses: 12,
            cpv: [],
            organoContratacion: 'Test'
        },
        criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
        requisitosTecnicos: { funcionales: [], normativa: [] },
        requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 500 }, tecnica: [] },
        restriccionesYRiesgos: { riesgos: [], killCriteria: [], penalizaciones: [] },
        modeloServicio: { sla: [], equipoMinimo: [] }
    };

    it('should not warn valid content', () => {
        const report = service.evaluateQuality(baseContent);
        expect(report.consistencyWarnings).toHaveLength(0);
    });

    it('should warn on negative budget', () => {
        const content = { ...baseContent, datosGenerales: { ...baseContent.datosGenerales, presupuesto: -1 } };
        const report = service.evaluateQuality(content);
        expect(report.consistencyWarnings).toContain("El presupuesto es 0 o negativo, lo cual es inusual.");
    });

    it('should warn on suspicious solvency ratio (>2x budget)', () => {
        const content = {
            ...baseContent,
            requisitosSolvencia: {
                ...baseContent.requisitosSolvencia,
                economica: { cifraNegocioAnualMinima: 3000 } // 3x budget
            }
        };
        const report = service.evaluateQuality(content);
        expect(report.consistencyWarnings).toBeDefined();
        // Check for substring match as message is dynamic
        const hasWarning = report.consistencyWarnings?.some(w => w.includes('La solvencia exigida'));
        expect(hasWarning).toBe(true);
    });

    it('should warn on duplicate kill criteria', () => {
        const content = {
            ...baseContent,
            restriccionesYRiesgos: {
                ...baseContent.restriccionesYRiesgos,
                killCriteria: [{ criterio: 'Same', justificacion: '', cita: '' }, { criterio: 'same', justificacion: '', cita: '' }] // Case insensitive check
            }
        };
        const report = service.evaluateQuality(content);
        const hasWarning = report.consistencyWarnings?.some(w => w.includes('Detectados elementos duplicados'));
        expect(hasWarning).toBe(true);
    });
});
