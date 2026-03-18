import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIService } from '../ai.service';
import { jobService } from '../job.service';

// Mock JobService
vi.mock('../job.service', () => ({
    jobService: {
        analyzeWithAgents: vi.fn()
    }
}));

describe('AIService', () => {
    let service: AIService;
    const mockAnalyze = jobService.analyzeWithAgents as unknown as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AIService();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.spyOn(console, 'log').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const validData = {
        datosGenerales: {
            titulo: "Test Licitación",
            presupuesto: 50000,
            moneda: "EUR",
            plazoEjecucionMeses: 12,
            cpv: ["12345678"],
            organoContratacion: "Ayuntamiento"
        },
        criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
        requisitosTecnicos: { funcionales: [], normativa: [] },
        requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 1000 }, tecnica: [] },
        restriccionesYRiesgos: { killCriteria: [], riesgos: [], penalizaciones: [] },
        modeloServicio: { sla: [], equipoMinimo: [] }
    };

    it('should call jobService.analyzeWithAgents when provider is openai', async () => {
        mockAnalyze.mockResolvedValue(validData);

        const onProgress = vi.fn();
        const result = await service.analyzePdfContent("base64data", onProgress, undefined, undefined, "openai", "file.pdf", "hash123");

        expect(result).toBeDefined();
        expect(result.datosGenerales.titulo).toBe("Test Licitación");
        expect(mockAnalyze).toHaveBeenCalledTimes(1);
    });

    it('should require filename and hash for openai provider', async () => {
        await expect(service.analyzePdfContent("base64data", undefined, undefined, undefined, "openai")).rejects.toThrow("Filename and Hash are required for OpenAI analysis");
    });
});
