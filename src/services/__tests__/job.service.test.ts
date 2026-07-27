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
        from: vi.fn(),
        realtime: {
            setAuth: vi.fn(),
        },
        channel: vi.fn(() => {
            const channel = {
                on: vi.fn(),
                subscribe: vi.fn(),
            };
            channel.on.mockReturnValue(channel);
            channel.subscribe.mockReturnValue(channel);
            return channel;
        }),
        removeChannel: vi.fn().mockResolvedValue('ok'),
        storage: {
            from: vi.fn(),
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
    from: ReturnType<typeof vi.fn>;
    realtime: {
        setAuth: ReturnType<typeof vi.fn>;
    };
    channel: ReturnType<typeof vi.fn>;
    removeChannel: ReturnType<typeof vi.fn>;
    storage: {
        from: ReturnType<typeof vi.fn>;
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

    it('forwards the durable job id as soon as it is created', async () => {
        const events: StreamEvent[] = [
            { type: 'job_created', jobId: 'job-123', status: 'pending', created: true, timestamp: Date.now() },
            { type: 'complete', result: validContent, workflow: {}, timestamp: Date.now() },
        ];
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildSseStream(events)));

        const onProgress = vi.fn();
        await service.analyzeWithAgents('base64', 'file.pdf', null, onProgress);

        expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ type: 'job_created', jobId: 'job-123' }));
    });

    it('processes phase_progress events and calls onProgress', async () => {
        const events: StreamEvent[] = [
            { type: 'phase_progress', phase: 'extraction', message: 'Extrayendo bloque 1', timestamp: Date.now() },
            { type: 'complete', result: validContent, workflow: {}, timestamp: Date.now() },
        ];
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildSseStream(events)));

        const onProgress = vi.fn();
        await service.analyzeWithAgents('base64', 'file.pdf', null, onProgress);

        const progressCalls = onProgress.mock.calls.filter(([e]) => e.type === 'phase_progress');
        expect(progressCalls.length).toBeGreaterThan(0);
    });

    it('processes retry_scheduled events and forwards metadata to onProgress', async () => {
        const events: StreamEvent[] = [
            {
                type: 'retry_scheduled',
                phase: 'extraction',
                blockName: 'datosGenerales',
                attempt: 2,
                maxAttempts: 5,
                waitMs: 30000,
                reason: 'rate_limit',
                blockIndex: 1,
                totalBlocks: 9,
                timestamp: Date.now(),
            },
            { type: 'complete', result: validContent, workflow: {}, timestamp: Date.now() },
        ];
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildSseStream(events)));

        const onProgress = vi.fn();
        await service.analyzeWithAgents('base64', 'file.pdf', null, onProgress);

        const retryEvent = onProgress.mock.calls.find(([event]) => event.type === 'retry_scheduled')?.[0];
        expect(retryEvent).toMatchObject({
            blockName: 'datosGenerales',
            attempt: 2,
            maxAttempts: 5,
            waitMs: 30000,
            reason: 'rate_limit',
        });
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
        const [, firstCallOpts] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect((secondCallOpts.headers as Record<string, string>)['X-Idempotency-Key']).toBe(
            (firstCallOpts.headers as Record<string, string>)['X-Idempotency-Key']
        );
    });

    it('recovers a completed durable job when SSE closes before the final event', async () => {
        const events: StreamEvent[] = [
            { type: 'job_created', jobId: 'job-recovery', status: 'processing', created: true, timestamp: Date.now() },
        ];
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildSseStream(events)));

        const single = vi.fn().mockResolvedValue({
            data: {
                status: 'completed',
                result: { result: validContent, workflow: { recovered: true } },
                error: null,
                phase: 'completed',
                updated_at: new Date().toISOString(),
            },
            error: null,
        });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        mockSupabase.from.mockReturnValue({ select });

        const result = await service.analyzeWithAgents('base64', 'file.pdf');

        expect(result.content).toBeDefined();
        expect(result.workflow).toEqual({ recovered: true });
        expect(mockSupabase.from).toHaveBeenCalledWith('analysis_jobs');
    });

    /**
     * A killed Edge Function isolate leaves the job in `processing` with no
     * error: slow and dead look identical if you only read `status`. The only
     * signal the browser has is whether the row moves at all.
     */
    describe('durable recovery of a job that stopped advancing', () => {
        function stubStalledJob(rows: () => Record<string, unknown>) {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue(
                    buildSseStream([
                        {
                            type: 'job_created',
                            jobId: 'job-stalled',
                            status: 'processing',
                            created: true,
                            timestamp: Date.now(),
                        },
                    ])
                )
            );

            const single = vi.fn().mockImplementation(() => Promise.resolve({ data: rows(), error: null }));
            const eq = vi.fn().mockReturnValue({ single });
            const select = vi.fn().mockReturnValue({ eq });
            mockSupabase.from.mockReturnValue({ select });
        }

        /**
         * Broadcast is best-effort: if no frame reaches the browser, polling is
         * the only thing left. It used to read the row and say nothing, so the UI
         * froze on the submit-time message while the worker advanced in the DB.
         */
        it('reports each phase from polling when no Broadcast frame arrives', async () => {
            const rows = [
                { status: 'processing', phase: 'ingestion_map' },
                { status: 'processing', phase: 'extraction' },
                { status: 'processing', phase: 'extraction' }, // checkpoint sin cambio de fase
                { status: 'processing', phase: 'consolidation' },
                {
                    status: 'completed',
                    phase: 'completed',
                    result: { result: validContent, workflow: {} },
                },
            ];
            let call = 0;
            stubStalledJob(() => {
                const row = rows[Math.min(call++, rows.length - 1)];
                return { result: null, error: null, updated_at: new Date().toISOString(), ...row };
            });

            const seen: string[] = [];
            vi.useFakeTimers();
            try {
                const pending = service.analyzeWithAgents('base64', 'file.pdf', null, (event) => {
                    if (event.type === 'phase_progress' && event.message) seen.push(event.message);
                });
                // 5 sondeos a 2s cada uno hasta que la fila llega a `completed`.
                await vi.advanceTimersByTimeAsync(30_000);
                await pending;
            } finally {
                vi.useRealTimers();
            }

            expect(seen).toEqual([
                'Subiendo e indexando los documentos...',
                'Extrayendo la información del expediente (puede tardar varios minutos)...',
                'Consolidando los resultados...',
            ]);
        });

        /**
         * La extracción es el tramo largo. Sin contador de bloques la barra se
         * queda clavada en el punto medio del rango de la fase durante minutos.
         */
        it('reports block-level progress while extraction advances', async () => {
            const rows = [
                { status: 'processing', phase: 'extraction', progress: { done: 2, total: 9 } },
                { status: 'processing', phase: 'extraction', progress: { done: 2, total: 9 } }, // sin avance
                { status: 'processing', phase: 'extraction', progress: { done: 5, total: 9 } },
                {
                    status: 'completed',
                    phase: 'completed',
                    result: { result: validContent, workflow: {} },
                },
            ];
            let call = 0;
            stubStalledJob(() => {
                const row = rows[Math.min(call++, rows.length - 1)];
                return { result: null, error: null, updated_at: new Date().toISOString(), ...row };
            });

            const events: Array<{ done?: number; total?: number }> = [];
            vi.useFakeTimers();
            try {
                const pending = service.analyzeWithAgents('base64', 'file.pdf', null, (event) => {
                    if (event.type === 'extraction_progress') {
                        events.push({ done: event.blockIndex, total: event.totalBlocks });
                    }
                });
                await vi.advanceTimersByTimeAsync(30_000);
                await pending;
            } finally {
                vi.useRealTimers();
            }

            // El checkpoint sin avance no debe repetir evento.
            expect(events).toEqual([
                { done: 2, total: 9 },
                { done: 5, total: 9 },
            ]);
        });

        it('carries the phase on block progress so the UI stepper can highlight it', async () => {
            stubStalledJob(() => ({
                status: 'processing',
                phase: 'extraction',
                result: null,
                error: null,
                updated_at: new Date().toISOString(),
                progress: { done: 3, total: 9 },
            }));

            const phases: Array<string | undefined> = [];
            vi.useFakeTimers();
            try {
                const pending = service.analyzeWithAgents('base64', 'file.pdf', null, (event) => {
                    if (event.type === 'extraction_progress') phases.push(event.phase);
                });
                const assertion = expect(pending).rejects.toThrow();
                await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
                await assertion;
            } finally {
                vi.useRealTimers();
            }

            expect(phases).toEqual(['extraction']);
        });

        it('reports an interrupted analysis when the job never advances', async () => {
            vi.useFakeTimers();
            try {
                // Exactly what the worker leaves behind when the platform pulls
                // the isolate mid-extraction: frozen row, no error written.
                stubStalledJob(() => ({
                    status: 'processing',
                    result: null,
                    error: null,
                    phase: 'extraction',
                    updated_at: '2026-07-27T12:09:16.916Z',
                }));

                const pending = service.analyzeWithAgents('base64', 'file.pdf');
                const assertion = expect(pending).rejects.toThrow(/se interrumpió antes de terminar/);
                await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
                await assertion;
            } finally {
                vi.useRealTimers();
            }
        });

        it('keeps the "still running" message while the job is still advancing', async () => {
            vi.useFakeTimers();
            try {
                let tick = 0;
                stubStalledJob(() => ({
                    status: 'processing',
                    result: null,
                    error: null,
                    phase: 'extraction',
                    updated_at: new Date(Date.UTC(2026, 6, 27, 12, 9, ++tick)).toISOString(),
                }));

                const pending = service.analyzeWithAgents('base64', 'file.pdf');
                const assertion = expect(pending).rejects.toThrow(/sigue en curso/);
                await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
                await assertion;
            } finally {
                vi.useRealTimers();
            }
        });

        it('surfaces the durable error once the job is reclaimed into a terminal state', async () => {
            stubStalledJob(() => ({
                status: 'dead_letter',
                result: null,
                error: 'El análisis se interrumpió antes de terminar y no dejó resultado recuperable.',
                phase: 'failed',
                updated_at: '2026-07-27T13:00:00.000Z',
            }));

            await expect(service.analyzeWithAgents('base64', 'file.pdf')).rejects.toThrow(
                /no dejó resultado recuperable/
            );
        });
    });

    it('uses signed Storage uploads and submits an async durable job', async () => {
        const file = new File(['%PDF-1.7'], 'pliego.pdf', { type: 'application/pdf' });
        const sha256 = 'a'.repeat(64);
        const uploadToSignedUrl = vi.fn().mockResolvedValue({ data: { path: 'signed/path' }, error: null });
        mockSupabase.storage.from.mockReturnValue({ uploadToSignedUrl });

        const single = vi.fn().mockResolvedValue({
            data: {
                status: 'completed',
                result: { result: validContent, workflow: { asyncWorker: true } },
                error: null,
                phase: 'completed',
                updated_at: new Date().toISOString(),
            },
            error: null,
        });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        mockSupabase.from.mockReturnValue({ select });

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        jobId: '123e4567-e89b-42d3-a456-426614174000',
                        created: true,
                        status: 'awaiting_upload',
                        uploads: [
                            {
                                documentId: 'doc-1',
                                name: 'pliego.pdf',
                                path: 'u1/job/doc-pliego.pdf',
                                token: 'signed-token',
                                mimeType: 'application/pdf',
                                sizeBytes: file.size,
                                sha256,
                            },
                        ],
                    }),
                    { status: 201 }
                )
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ jobId: '123e4567-e89b-42d3-a456-426614174000', status: 'queued' }), {
                    status: 202,
                })
            );
        vi.stubGlobal('fetch', fetchMock);

        const onProgress = vi.fn();
        const result = await service.analyzeWithAgents('', 'pliego.pdf', null, onProgress, undefined, undefined, [
            { file, sha256 },
        ]);

        expect(result.workflow).toEqual({ asyncWorker: true });
        expect(mockSupabase.storage.from).toHaveBeenCalledWith('analysis-pdfs');
        expect(uploadToSignedUrl).toHaveBeenCalledWith('u1/job/doc-pliego.pdf', 'signed-token', file, {
            contentType: 'application/pdf',
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toEqual({
            action: 'submit',
            jobId: '123e4567-e89b-42d3-a456-426614174000',
        });
        expect(onProgress).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'job_created',
                jobId: '123e4567-e89b-42d3-a456-426614174000',
            })
        );
    });

    it('refreshes the JWT once when the async control plane returns 401', async () => {
        const file = new File(['%PDF-1.7'], 'pliego.pdf', { type: 'application/pdf' });
        const refreshedSession = { ...validSession, access_token: 'async-refreshed-token' };
        mockSupabase.auth.refreshSession.mockResolvedValue({ data: { session: refreshedSession }, error: null });

        const single = vi.fn().mockResolvedValue({
            data: {
                status: 'completed',
                result: { result: validContent, workflow: { resumed: true } },
                error: null,
                phase: 'completed',
            },
            error: null,
        });
        mockSupabase.from.mockReturnValue({
            select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }),
        });

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'expired' }), { status: 401 }))
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        jobId: '123e4567-e89b-42d3-a456-426614174001',
                        created: false,
                        status: 'completed',
                        uploads: [],
                    }),
                    { status: 200 }
                )
            );
        vi.stubGlobal('fetch', fetchMock);

        const result = await service.analyzeWithAgents('', 'pliego.pdf', null, undefined, undefined, undefined, [
            { file, sha256: 'a'.repeat(64) },
        ]);

        expect(result.workflow).toEqual({ resumed: true });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toMatchObject({
            Authorization: 'Bearer async-refreshed-token',
        });
        expect(mockSupabase.realtime.setAuth).toHaveBeenCalledWith('async-refreshed-token');
    });

    it('infers durable upload MIME types before creating the job', async () => {
        const sources = [
            { file: new File(['docx'], 'anexo.docx'), sha256: 'a'.repeat(64) },
            { file: new File(['txt'], 'notas.txt'), sha256: 'b'.repeat(64) },
            { file: new File(['pdf'], 'sin-tipo.bin'), sha256: 'c'.repeat(64) },
        ];
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                new Response(JSON.stringify({ created: true, status: 'awaiting_upload', uploads: [] }), { status: 201 })
            );
        vi.stubGlobal('fetch', fetchMock);

        await expect(
            service.analyzeWithAgents('', 'anexo.docx', null, undefined, undefined, undefined, sources)
        ).rejects.toThrow('El servidor no devolvió el job durable');

        const requestBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
        expect(requestBody.files.map((entry: { mimeType: string }) => entry.mimeType)).toEqual([
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'application/pdf',
        ]);
    });

    it('rejects a signed plan whose document count does not match the selection', async () => {
        const file = new File(['%PDF-1.7'], 'pliego.pdf', { type: 'application/pdf' });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        jobId: '123e4567-e89b-42d3-a456-426614174002',
                        created: true,
                        status: 'awaiting_upload',
                        uploads: [{}, {}],
                    }),
                    { status: 201 }
                )
            )
        );

        await expect(
            service.analyzeWithAgents('', 'pliego.pdf', null, undefined, undefined, undefined, [
                { file, sha256: 'a'.repeat(64) },
            ])
        ).rejects.toThrow('El plan firmado no coincide con los documentos seleccionados');
    });

    it('rejects a signed upload when its integrity metadata differs', async () => {
        const file = new File(['%PDF-1.7'], 'pliego.pdf', { type: 'application/pdf' });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        jobId: '123e4567-e89b-42d3-a456-426614174003',
                        created: true,
                        status: 'awaiting_upload',
                        uploads: [
                            {
                                documentId: 'doc-1',
                                name: 'pliego.pdf',
                                path: 'signed/path',
                                token: 'token',
                                mimeType: 'application/pdf',
                                sizeBytes: file.size,
                                sha256: 'b'.repeat(64),
                            },
                        ],
                    }),
                    { status: 201 }
                )
            )
        );

        await expect(
            service.analyzeWithAgents('', 'pliego.pdf', null, undefined, undefined, undefined, [
                { file, sha256: 'a'.repeat(64) },
            ])
        ).rejects.toThrow('El plan firmado no coincide con pliego.pdf');
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
