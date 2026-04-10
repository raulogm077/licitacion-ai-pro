import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobService, StreamEvent } from '../job.service';
import { tf } from '../../test-utils/tracked-field-factory';

// Mock supabase
vi.mock('../../config/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
            refreshSession: vi.fn(),
        },
    },
}));

// Mock logger
vi.mock('../logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import { supabase } from '../../config/supabase';

const mockSupabase = supabase as unknown as {
    auth: {
        getSession: ReturnType<typeof vi.fn>;
        refreshSession: ReturnType<typeof vi.fn>;
    };
};

/** Build a SSE stream from an array of events */
function buildSseStream(events: StreamEvent[]): Response {
    const lines = events.map((e) => `data: ${JSON.stringify(e)}\n`).join('\n') + '\n';
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(lines));
            controller.close();
        },
    });
    return new Response(stream, { status: 200 });
}

const NOW = Math.floor(Date.now() / 1000);

const validSession = {
    user: { id: 'u1', email: 'test@test.com' },
    access_token: 'token123',
    expires_at: NOW + 3600,
};

/** Minimal valid LicitacionContent for schema parsing */
const validContent = {
    datosGenerales: {
        titulo: tf('Test'),
        presupuesto: tf(1000),
        moneda: tf('EUR'),
        plazoEjecucionMeses: tf(12),
        cpv: tf([]),
        organoContratacion: tf('Org'),
    },
    criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
    requisitosTecnicos: { funcionales: [], normativa: [] },
    requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [], profesional: [] },
    restriccionesYRiesgos: { riesgos: [], killCriteria: [], penalizaciones: [] },
    modeloServicio: { sla: [], equipoMinimo: [] },
};

describe('JobService', () => {
    let service: JobService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new JobService();

        // Default: valid session, not near expiry
        mockSupabase.auth.getSession.mockResolvedValue({
            data: { session: validSession },
            error: null,
        });
    });

    it('throws when user is not authenticated', async () => {
        mockSupabase.auth.getSession.mockResolvedValue({
            data: { session: null },
            error: null,
        });

        await expect(service.analyzeWithAgents('base64', 'file.pdf')).rejects.toThrow('Usuario no autenticado');
    });

    it('refreshes session when token expires in less than 300 seconds', async () => {
        const nearlyExpired = { ...validSession, expires_at: NOW + 30 };
        mockSupabase.auth.getSession.mockResolvedValue({
            data: { session: nearlyExpired },
        });
        mockSupabase.auth.refreshSession.mockResolvedValue({
            data: { session: validSession },
            error: null,
        });

        const completeEvent: StreamEvent = {
            type: 'complete',
            result: validContent,
            workflow: {},
            timestamp: Date.now(),
        };

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildSseStream([completeEvent])));

        await service.analyzeWithAgents('base64', 'file.pdf');

        expect(mockSupabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    });

    it('throws when refresh fails', async () => {
        const nearlyExpired = { ...validSession, expires_at: NOW + 30 };
        mockSupabase.auth.getSession.mockResolvedValue({
            data: { session: nearlyExpired },
        });
        mockSupabase.auth.refreshSession.mockResolvedValue({
            data: { session: null },
            error: new Error('Refresh failed'),
        });

        await expect(service.analyzeWithAgents('base64', 'file.pdf')).rejects.toThrow('Sesión expirada');
    });

    it('processes heartbeat events without error', async () => {
        const events: StreamEvent[] = [
            { type: 'heartbeat', timestamp: Date.now() },
            { type: 'complete', result: validContent, workflow: {}, timestamp: Date.now() },
        ];
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildSseStream(events)));

        const onProgress = vi.fn();
        await service.analyzeWithAgents('base64', 'file.pdf', null, onProgress);

        const heartbeatCalls = onProgress.mock.calls.filter(([e]) => e.type === 'heartbeat');
        expect(heartbeatCalls.length).toBe(1);
    });

    it('processes phase_progress events and calls onProgress', async () => {
        const events: StreamEvent[] = [
            { type: 'phase_progress', phase: 'extraction', blockIndex: 1, totalBlocks: 9, timestamp: Date.now() },
            { type: 'complete', result: validContent, workflow: {}, timestamp: Date.now() },
        ];
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildSseStream(events)));

        const onProgress = vi.fn();
        await service.analyzeWithAgents('base64', 'file.pdf', null, onProgress);

        const progressCalls = onProgress.mock.calls.filter(([e]) => e.type === 'phase_progress');
        expect(progressCalls.length).toBeGreaterThan(0);
    });

    it('resolves with validated content on complete event', async () => {
        const completeEvent: StreamEvent = {
            type: 'complete',
            result: validContent,
            workflow: { status: 'completed' },
            timestamp: Date.now(),
        };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildSseStream([completeEvent])));

        const result = await service.analyzeWithAgents('base64', 'file.pdf');

        expect(result.content).toBeDefined();
        expect(result.workflow).toEqual({ status: 'completed' });
    });

    it('rejects when stream emits an error event', async () => {
        const events: StreamEvent[] = [{ type: 'error', message: 'Pipeline failed', timestamp: Date.now() }];
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildSseStream(events)));

        await expect(service.analyzeWithAgents('base64', 'file.pdf')).rejects.toThrow('Pipeline failed');
    });

    it('rejects on non-401 HTTP errors without retrying', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 }))
        );

        await expect(service.analyzeWithAgents('base64', 'file.pdf')).rejects.toThrow('Internal Server Error');
        // refreshSession should NOT be called for non-401 errors
        expect(mockSupabase.auth.refreshSession).not.toHaveBeenCalled();
    });

    it('retries with refreshed token on 401 and succeeds', async () => {
        const completeEvent: StreamEvent = {
            type: 'complete',
            result: validContent,
            workflow: {},
            timestamp: Date.now(),
        };
        const refreshedSession = { ...validSession, access_token: 'new-token-456' };
        mockSupabase.auth.refreshSession.mockResolvedValue({
            data: { session: refreshedSession },
            error: null,
        });
        const mockFetch = vi
            .fn()
            // First call → 401
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'Token inválido o expirado' }), { status: 401 })
            )
            // Second call (retry) → success
            .mockResolvedValueOnce(buildSseStream([completeEvent]));
        vi.stubGlobal('fetch', mockFetch);

        const result = await service.analyzeWithAgents('base64', 'file.pdf');

        expect(result.content).toBeDefined();
        expect(mockSupabase.auth.refreshSession).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        // Second call must use the new token
        const [, secondCallOpts] = mockFetch.mock.calls[1] as [string, RequestInit];
        expect((secondCallOpts.headers as Record<string, string>)['Authorization']).toBe('Bearer new-token-456');
    });

    it('throws "Sesión expirada" when 401 retry refresh fails', async () => {
        mockSupabase.auth.refreshSession.mockResolvedValue({
            data: { session: null },
            error: new Error('Refresh token expired'),
        });
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    new Response(JSON.stringify({ error: 'Token inválido o expirado' }), { status: 401 })
                )
        );

        await expect(service.analyzeWithAgents('base64', 'file.pdf')).rejects.toThrow('Sesión expirada');
    });

    it('respects AbortSignal cancellation', async () => {
        const controller = new AbortController();

        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
                // Honor the signal
                if (opts.signal?.aborted) {
                    return Promise.reject(new DOMException('Aborted', 'AbortError'));
                }
                return new Promise((_, reject) => {
                    opts.signal?.addEventListener('abort', () => {
                        reject(new DOMException('Aborted', 'AbortError'));
                    });
                });
            })
        );

        controller.abort();

        await expect(
            service.analyzeWithAgents('base64', 'file.pdf', null, undefined, undefined, controller.signal)
        ).rejects.toThrow();
    });
});
