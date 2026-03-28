import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIService } from '../ai.service';
import { jobService } from '../job.service';
import { tf } from '../../test-utils/tracked-field-factory';

// Mock JobService
vi.mock('../job.service', () => ({
    jobService: {
        analyzeWithAgents: vi.fn(),
    },
}));

describe('AIService', () => {
    let service: AIService;
    const mockAnalyze = jobService.analyzeWithAgents as unknown as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AIService();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const validResult = {
        content: {
            datosGenerales: {
                titulo: tf('Test Licitación'),
                presupuesto: tf(50000),
                moneda: tf('EUR'),
                plazoEjecucionMeses: tf(12),
                cpv: tf(['12345678']),
                organoContratacion: tf('Ayuntamiento'),
            },
            criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
            requisitosTecnicos: { funcionales: [], normativa: [] },
            requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 1000 }, tecnica: [], profesional: [] },
            restriccionesYRiesgos: { killCriteria: [], riesgos: [], penalizaciones: [] },
            modeloServicio: { sla: [], equipoMinimo: [] },
        },
        workflow: {},
    };

    it('should call jobService.analyzeWithAgents', async () => {
        mockAnalyze.mockResolvedValue(validResult);

        const onProgress = vi.fn();
        const result = await service.analyzePdfContent('base64data', onProgress, undefined, 'file.pdf', 'hash123');

        expect(result).toBeDefined();
        expect(result.content.datosGenerales.titulo).toEqual(tf('Test Licitación'));
        expect(mockAnalyze).toHaveBeenCalledTimes(1);
    });

    it('should require filename and hash', async () => {
        await expect(service.analyzePdfContent('base64data')).rejects.toThrow('Filename and Hash are required');
    });
});
