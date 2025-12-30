import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeWithSSE } from './sse-client';

// Mock config/service-registry
vi.mock('../config/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'mock-token' } } })
        }
    }
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('analyzeWithSSE', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle successful SSE stream', async () => {
        const events = [
            'event: stage\ndata: {"stage":"auth"}\n\n',
            'event: log\ndata: {"level":"info","code":"TEST","message":"Test log"}\n\n',
            'event: result\ndata: {"licitacionData":{"datosGenerales":{"titulo":"Test"}}}\n\n',
            'event: done\ndata: {}\n\n'
        ];

        const stream = new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder();
                events.forEach(e => controller.enqueue(encoder.encode(e)));
                controller.close();
            }
        });

        mockFetch.mockResolvedValue({
            ok: true,
            body: stream
        });

        const callbacks = {
            onStage: vi.fn(),
            onLog: vi.fn(),
            onResult: vi.fn(),
            onComplete: vi.fn()
        };

        await analyzeWithSSE(
            { provider: 'openai', readingMode: 'full', hash: 'abc' },
            callbacks
        );

        expect(callbacks.onStage).toHaveBeenCalledWith({ stage: 'auth' });
        expect(callbacks.onLog).toHaveBeenCalledWith(expect.objectContaining({ message: 'Test log' }));
        expect(callbacks.onResult).toHaveBeenCalled();
        expect(callbacks.onComplete).toHaveBeenCalled();
    });

    it('should handle network failure gracefully (TC-FE-01)', async () => {
        const networkError = new Error('Network Error');
        mockFetch.mockRejectedValue(networkError);

        const callbacks = {
            onError: vi.fn()
        };

        await expect(analyzeWithSSE(
            { provider: 'openai', readingMode: 'full', hash: 'abc' },
            callbacks
        )).rejects.toThrow('Network Error');

        // It might not call onError if the fetch itself throws immediate rejection
        // But let's check behavior. analyzeWithSSE awaits fetch.
    });

    it('should handle stream interruption', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.error(new Error('Stream Broken'));
            }
        });

        mockFetch.mockResolvedValue({
            ok: true,
            body: stream
        });

        await expect(analyzeWithSSE(
            { provider: 'openai', readingMode: 'full', hash: 'abc' },
            {}
        )).rejects.toThrow('Stream Broken');
    });
});
