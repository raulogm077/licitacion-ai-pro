import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIService, LicitacionAIError } from '../ai.service';
import { jobService } from '../job.service';

vi.mock('../job.service', () => ({
    jobService: {
        analyzeWithAgents: vi.fn(),
    },
}));

describe('AIService - AbortController', () => {
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

    it('should abort analysis when signal is triggered before start', async () => {
        const controller = new AbortController();
        controller.abort();

        await expect(
            service.analyzePdfContent('base64content', undefined, controller.signal, 'file.pdf', 'hash123')
        ).rejects.toThrow('Análisis cancelado por el usuario');
    });

    it('should throw LicitacionAIError on cancellation', async () => {
        const controller = new AbortController();
        controller.abort();

        try {
            await service.analyzePdfContent('base64content', undefined, controller.signal, 'file.pdf', 'hash123');
            expect.fail('Debería haber lanzado un error');
        } catch (error) {
            expect(error).toBeInstanceOf(LicitacionAIError);
            expect((error as LicitacionAIError).message).toContain('cancelado');
        }
    });

    it('should accept AbortSignal parameter without throwing when not aborted', async () => {
        const controller = new AbortController();

        mockAnalyze.mockResolvedValue({ content: {}, workflow: {} });

        const promise = service.analyzePdfContent('base64content', undefined, controller.signal, 'file.pdf', 'hash123');
        await expect(promise).resolves.not.toThrow();
    });
});
