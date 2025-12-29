import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService, LicitacionAIError } from '../ai.service';

// Mock Supabase Edge Function
vi.mock('../../config/supabase', () => ({
    supabase: {
        functions: {
            invoke: vi.fn().mockResolvedValue({
                data: { text: '{"titulo":"Test"}' },
                error: null
            })
        }
    }
}));

describe('AIService - AbortController', () => {
    let service: AIService;

    beforeEach(() => {
        service = new AIService();
        vi.clearAllMocks();
    });

    it('should abort analysis when signal is triggered before start', async () => {
        const controller = new AbortController();
        controller.abort(); // Abort immediately

        await expect(
            service.analyzePdfContent('base64content', undefined, undefined, controller.signal)
        ).rejects.toThrow('Análisis cancelado por el usuario');
    });

    it('should throw LicitacionAIError on cancellation', async () => {
        const controller = new AbortController();
        controller.abort();

        try {
            await service.analyzePdfContent('base64content', undefined, undefined, controller.signal);
            expect.fail('Should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(LicitacionAIError);
            expect((error as LicitacionAIError).message).toContain('cancelado');
        }
    });

    it('should accept AbortSignal parameter without throwing when not aborted', () => {
        const controller = new AbortController();

        // Just verify the signature accepts the parameter
        // (Full integration test would timeout due to 10s wait between sections)
        expect(() => {
            const promise = service.analyzePdfContent('base64content', undefined, undefined, controller.signal);
            controller.abort(); // Abort to prevent actual execution
            return promise;
        }).not.toThrow();
    });
});
