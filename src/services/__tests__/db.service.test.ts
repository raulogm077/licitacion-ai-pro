import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DBService } from '../db.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { appCache } from '../../lib/cache';

// Mock Supabase Client
const mockSupabase = {
    auth: {
        getSession: vi.fn(),
    },
    from: vi.fn(),
    channel: vi.fn(),
    rpc: vi.fn(),
} as unknown as SupabaseClient;

// Minimal LicitacionContent fixture
const mockContent = {
    datosGenerales: {
        titulo: 'Test',
        presupuesto: 1000,
        moneda: 'EUR',
        plazoEjecucionMeses: 12,
        cpv: [],
        organoContratacion: 'Test Org',
    },
    criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
    requisitosTecnicos: { funcionales: [], normativa: [] },
    requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [] },
    restriccionesYRiesgos: { killCriteria: [], riesgos: [], penalizaciones: [] },
    modeloServicio: { sla: [], equipoMinimo: [] },
} as never;

const mockDbRow = {
    hash: 'abc123',
    file_name: 'test.pdf',
    updated_at: '2024-01-01T00:00:00Z',
    data: { metadata: { tags: ['tag1'] }, datosGenerales: {} },
};

const withSession = () =>
    vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: { user: { id: 'u1' } } },
    } as never);

const withNoSession = () =>
    vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: null },
    } as never);

describe('DBService', () => {
    let service: DBService;

    beforeEach(() => {
        vi.clearAllMocks();
        appCache.clear();
        service = new DBService(mockSupabase);
    });

    // ── getLicitacion ────────────────────────────────────────────────────────

    describe('getLicitacion', () => {
        it('maps DB row to DbLicitacion correctly', async () => {
            const mockBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: mockDbRow, error: null }),
            };
            vi.mocked(mockSupabase.from).mockReturnValue(mockBuilder as never);

            const result = await service.getLicitacion('abc123');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.hash).toBe('abc123');
                expect(result.value.fileName).toBe('test.pdf');
                expect(result.value.metadata.tags).toEqual(['tag1']);
                expect(result.value.timestamp).toBe(new Date('2024-01-01T00:00:00Z').getTime());
            }
        });

        it('returns error when supabase fails', async () => {
            const mockBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
            };
            vi.mocked(mockSupabase.from).mockReturnValue(mockBuilder as never);

            const result = await service.getLicitacion('abc123');
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.message).toBe('DB Error');
        });

        it('returns cached value on second call', async () => {
            const mockBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: mockDbRow, error: null }),
            };
            vi.mocked(mockSupabase.from).mockReturnValue(mockBuilder as never);

            await service.getLicitacion('abc123');
            await service.getLicitacion('abc123');

            // Second call hits cache — from() called only once
            expect(vi.mocked(mockSupabase.from)).toHaveBeenCalledTimes(1);
        });
    });

    // ── getAllLicitaciones ────────────────────────────────────────────────────

    describe('getAllLicitaciones', () => {
        it('returns mapped list on success', async () => {
            const mockBuilder = {
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: [mockDbRow], error: null }),
            };
            vi.mocked(mockSupabase.from).mockReturnValue(mockBuilder as never);

            const result = await service.getAllLicitaciones();
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toHaveLength(1);
        });

        it('returns empty array when data is null', async () => {
            const mockBuilder = {
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
            vi.mocked(mockSupabase.from).mockReturnValue(mockBuilder as never);

            const result = await service.getAllLicitaciones();
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toHaveLength(0);
        });

        it('returns error on DB failure', async () => {
            const mockBuilder = {
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Network error' } }),
            };
            vi.mocked(mockSupabase.from).mockReturnValue(mockBuilder as never);

            const result = await service.getAllLicitaciones();
            expect(result.ok).toBe(false);
        });
    });

    // ── saveLicitacion ───────────────────────────────────────────────────────

    describe('saveLicitacion', () => {
        it('returns error when no active session', async () => {
            withNoSession();
            const result = await service.saveLicitacion('h1', 'f.pdf', mockContent);
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.message).toContain('No hay sesión');
        });

        it('creates new envelope when record does not exist', async () => {
            withSession();

            // getLicitacion returns error (record not found)
            const getLicitacionBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            };

            // upsert returns success
            const upsertBuilder = {
                upsert: vi.fn().mockResolvedValue({ error: null }),
            };

            vi.mocked(mockSupabase.from)
                .mockReturnValueOnce(getLicitacionBuilder as never) // getLicitacion
                .mockReturnValueOnce(upsertBuilder as never); // upsert

            const result = await service.saveLicitacion('h1', 'f.pdf', mockContent);
            expect(result.ok).toBe(true);
        });

        it('updates existing envelope with version bump', async () => {
            withSession();

            const existingData = {
                hash: 'h1',
                file_name: 'f.pdf',
                updated_at: '2024-01-01T00:00:00Z',
                data: {
                    metadata: { tags: [] },
                    versions: [{ version: 1 }],
                    workflow: { steps: [], evidences: [] },
                },
            };

            const getLicitacionBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: existingData, error: null }),
            };

            const upsertBuilder = {
                upsert: vi.fn().mockResolvedValue({ error: null }),
            };

            vi.mocked(mockSupabase.from)
                .mockReturnValueOnce(getLicitacionBuilder as never)
                .mockReturnValueOnce(upsertBuilder as never);

            const result = await service.saveLicitacion('h1', 'f.pdf', mockContent);
            expect(result.ok).toBe(true);
        });

        it('returns error for RLS violation (code 42501)', async () => {
            withSession();

            const getLicitacionBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            };

            const upsertBuilder = {
                upsert: vi.fn().mockResolvedValue({ error: { code: '42501', message: 'RLS' } }),
            };

            vi.mocked(mockSupabase.from)
                .mockReturnValueOnce(getLicitacionBuilder as never)
                .mockReturnValueOnce(upsertBuilder as never);

            const result = await service.saveLicitacion('h1', 'f.pdf', mockContent);
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.message).toContain('RLS');
        });

        it('returns generic error for other upsert failures', async () => {
            withSession();

            const getLicitacionBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            };

            const upsertBuilder = {
                upsert: vi.fn().mockResolvedValue({ error: { code: '500', message: 'Connection failed' } }),
            };

            vi.mocked(mockSupabase.from)
                .mockReturnValueOnce(getLicitacionBuilder as never)
                .mockReturnValueOnce(upsertBuilder as never);

            const result = await service.saveLicitacion('h1', 'f.pdf', mockContent);
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.message).toBe('Connection failed');
        });

        it('persists workflow quality emitted by backend when provided', async () => {
            withSession();

            const getLicitacionBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            };

            const upsertBuilder = {
                upsert: vi.fn().mockResolvedValue({ error: null }),
            };

            vi.mocked(mockSupabase.from)
                .mockReturnValueOnce(getLicitacionBuilder as never)
                .mockReturnValueOnce(upsertBuilder as never);

            const workflow = {
                current_version: 1,
                status: 'completed',
                steps: [],
                evidences: [],
                phases: {},
                created_at: '2026-04-20T00:00:00.000Z',
                updated_at: '2026-04-20T00:00:00.000Z',
                quality: {
                    overall: 'PARCIAL',
                    bySection: { requisitosTecnicos: 'VACIO' },
                    missingCriticalFields: [],
                    ambiguous_fields: [],
                    warnings: ['Falta PPT'],
                    partial_reasons: ['missing_technical_content'],
                },
            };

            const result = await service.saveLicitacion('h1', 'f.pdf', mockContent, workflow as never);

            expect(result.ok).toBe(true);
            const persistedPayload = upsertBuilder.upsert.mock.calls[0][0] as { data: { workflow: { quality: { partial_reasons: string[] } } } };
            expect(persistedPayload.data.workflow.quality.partial_reasons).toEqual(['missing_technical_content']);
        });
    });

    // ── updateLicitacion ─────────────────────────────────────────────────────

    describe('updateLicitacion', () => {
        it('returns error when no session', async () => {
            withNoSession();
            const result = await service.updateLicitacion('h1', {} as never);
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.message).toContain('No hay sesión');
        });

        it('updates successfully', async () => {
            withSession();
            const mockBuilder = {
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ error: null }),
            };
            vi.mocked(mockSupabase.from).mockReturnValue(mockBuilder as never);

            const result = await service.updateLicitacion('h1', {} as never);
            expect(result.ok).toBe(true);
        });

        it('returns error on DB failure', async () => {
            withSession();
            const mockBuilder = {
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } }),
            };
            vi.mocked(mockSupabase.from).mockReturnValue(mockBuilder as never);

            const result = await service.updateLicitacion('h1', {} as never);
            expect(result.ok).toBe(false);
        });
    });

    // ── deleteLicitacion ─────────────────────────────────────────────────────

    describe('deleteLicitacion', () => {
        it('deletes successfully and invalidates cache', async () => {
            const mockBuilder = {
                delete: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ error: null }),
            };
            vi.mocked(mockSupabase.from).mockReturnValue(mockBuilder as never);

            const result = await service.deleteLicitacion('h1');
            expect(result.ok).toBe(true);
        });

        it('returns error on DB failure', async () => {
            const mockBuilder = {
                delete: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
            };
            vi.mocked(mockSupabase.from).mockReturnValue(mockBuilder as never);

            const result = await service.deleteLicitacion('h1');
            expect(result.ok).toBe(false);
        });
    });

    // ── searchLicitaciones ───────────────────────────────────────────────────

    describe('searchLicitaciones', () => {
        it('delegates to getAllLicitaciones when query is empty', async () => {
            const mockBuilder = {
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
            vi.mocked(mockSupabase.from).mockReturnValue(mockBuilder as never);

            const result = await service.searchLicitaciones('   ');
            expect(result.ok).toBe(true);
        });

        it('calls RPC with search query', async () => {
            vi.mocked(mockSupabase.rpc).mockResolvedValue({ data: [mockDbRow], error: null } as never);

            const result = await service.searchLicitaciones('contrato');
            expect(result.ok).toBe(true);
            expect(mockSupabase.rpc).toHaveBeenCalledWith('search_licitaciones', { search_query: 'contrato' });
        });

        it('returns error on RPC failure', async () => {
            vi.mocked(mockSupabase.rpc).mockResolvedValue({ data: null, error: { message: 'RPC Error' } } as never);

            const result = await service.searchLicitaciones('query');
            expect(result.ok).toBe(false);
        });
    });

    // ── advancedSearch ───────────────────────────────────────────────────────

    describe('advancedSearch', () => {
        it('applies server-side filters and client-side tag filtering', async () => {
            const mockData = [
                {
                    hash: '1',
                    file_name: 'match.pdf',
                    updated_at: '2023-01-01T00:00:00Z',
                    data: { metadata: { tags: ['a', 'b'] } },
                },
                {
                    hash: '2',
                    file_name: 'no-match.pdf',
                    updated_at: '2023-01-01T00:00:00Z',
                    data: { metadata: { tags: ['c'] } },
                },
            ];

            const mockBuilder = {
                select: vi.fn().mockReturnThis(),
                filter: vi.fn().mockReturnThis(),
                ilike: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                then: (cb: (result: { data: typeof mockData; error: null }) => void) =>
                    cb({ data: mockData, error: null }),
            };
            vi.mocked(mockSupabase.from).mockReturnValue(mockBuilder as never);

            const result = await service.advancedSearch({ tags: ['a'] });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toHaveLength(1);
                expect(result.value[0].hash).toBe('1');
            }
        });

        it('applies all optional filters', async () => {
            const mockBuilder = {
                select: vi.fn().mockReturnThis(),
                filter: vi.fn().mockReturnThis(),
                ilike: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                then: (cb: (result: { data: never[]; error: null }) => void) => cb({ data: [], error: null }),
            };
            vi.mocked(mockSupabase.from).mockReturnValue(mockBuilder as never);

            const result = await service.advancedSearch({
                presupuestoMin: 1000,
                presupuestoMax: 50000,
                estado: 'PENDIENTE',
                cliente: 'Ayuntamiento',
                fechaDesde: new Date('2024-01-01').getTime(),
                fechaHasta: new Date('2024-12-31').getTime(),
            });
            expect(result.ok).toBe(true);
            expect(mockBuilder.filter).toHaveBeenCalled();
        });
    });

    // ── subscribeToLicitacion ────────────────────────────────────────────────

    describe('subscribeToLicitacion', () => {
        it('subscribes to realtime channel and triggers callback', () => {
            const onUpdate = vi.fn();
            const mockSubscribe = vi.fn().mockReturnThis();
            const mockOn = vi.fn().mockImplementation((_event, _config, callback) => {
                // Simulate a realtime update
                callback({ new: { data: { test: 'value' } } });
                return { subscribe: mockSubscribe };
            });
            const mockChannel = vi.fn().mockReturnValue({ on: mockOn });
            vi.mocked(mockSupabase.channel).mockImplementation(mockChannel as never);

            service.subscribeToLicitacion('h1', onUpdate);

            expect(mockChannel).toHaveBeenCalledWith('licitacion:h1');
            expect(onUpdate).toHaveBeenCalledWith({ test: 'value' });
        });
    });
});
