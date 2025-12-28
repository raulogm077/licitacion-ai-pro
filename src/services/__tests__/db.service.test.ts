import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { dbService } from '../db.service';
import { supabase } from '../../config/supabase';
import { LicitacionData } from '../../types';

// Mock Supabase client
vi.mock('../../config/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            upsert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            filter: vi.fn().mockReturnThis(),
        })),
    },
}));

describe('DBService', () => {
    const mockData: LicitacionData = {
        metadata: {
            tags: ['test', 'urgent'],
            cliente: 'Test Client',
            estado: 'PENDIENTE',
            importeAdjudicado: 0,
            fechaCreacion: Date.now(),
            ultimaModificacion: Date.now()
        },
        datosGenerales: {
            titulo: 'Test Licitacion',
            presupuesto: 10000,
            moneda: 'EUR',
            plazoEjecucionMeses: 12,
            cpv: ['12345678'],
            organoContratacion: 'Entidad Test',
            fechaLimitePresentacion: '2025-01-01'
        },
        criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
        requisitosTecnicos: { funcionales: [], normativa: [] },
        requisitosSolvencia: {
            economica: { cifraNegocioAnualMinima: 1000 },
            tecnica: []
        },
        restriccionesYRiesgos: { killCriteria: [], riesgos: [], penalizaciones: [] },
        modeloServicio: { sla: [], equipoMinimo: [] }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('saveLicitacion', () => {
        it('should call upsert with correct params', async () => {
            const upsertSpy = vi.fn().mockResolvedValue({ error: null });
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({
                upsert: upsertSpy
            });

            await dbService.saveLicitacion('hash123', 'test.pdf', mockData);

            expect(supabase.from).toHaveBeenCalledWith('licitaciones');
            expect(upsertSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    hash: 'hash123',
                    file_name: 'test.pdf',
                    data: mockData
                }),
                expect.objectContaining({ onConflict: 'user_id, hash' })
            );
        });

        it('should throw error if upsert fails', async () => {
            const upsertSpy = vi.fn().mockResolvedValue({ error: new Error('DB Error') });
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({
                upsert: upsertSpy
            });

            await expect(dbService.saveLicitacion('hash123', 'test.pdf', mockData))
                .rejects.toThrow('DB Error');
        });

        it('should auto-populate metadata if missing', async () => {
            const dataWithoutMeta = { ...mockData, metadata: undefined } as unknown as LicitacionData;
            const upsertSpy = vi.fn().mockResolvedValue({ error: null });
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({ upsert: upsertSpy });

            await dbService.saveLicitacion('hash123', 'test.pdf', dataWithoutMeta);

            expect(dataWithoutMeta.metadata!).toBeDefined();
            expect(dataWithoutMeta.metadata?.tags).toEqual([]);
        });
    });

    describe('getLicitacion', () => {
        it('should return formatted data when found', async () => {
            const mockResponse = {
                data: {
                    hash: 'hash123',
                    file_name: 'test.pdf',
                    updated_at: '2025-01-01T00:00:00Z',
                    data: mockData
                },
                error: null
            };

            const singleSpy = vi.fn().mockResolvedValue(mockResponse);
            const eqSpy = vi.fn().mockReturnValue({ single: singleSpy });
            const selectSpy = vi.fn().mockReturnValue({ eq: eqSpy });

            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({ select: selectSpy });

            const result = await dbService.getLicitacion('hash123');

            expect(result).toBeDefined();
            expect(result?.hash).toBe('hash123');
            expect(result?.fileName).toBe('test.pdf');
            expect(result?.data).toEqual(mockData);
        });

        it('should return undefined if not found', async () => {
            const mockResponse = { data: null, error: { message: 'Not found' } };
            const singleSpy = vi.fn().mockResolvedValue(mockResponse);
            const eqSpy = vi.fn().mockReturnValue({ single: singleSpy });
            const selectSpy = vi.fn().mockReturnValue({ eq: eqSpy });

            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({ select: selectSpy });

            const result = await dbService.getLicitacion('hash123');
            expect(result).toBeUndefined();
        });
    });

    describe('deleteLicitacion', () => {
        it('should call delete on correct hash', async () => {
            const eqSpy = vi.fn().mockResolvedValue({ error: null });
            const deleteSpy = vi.fn().mockReturnValue({ eq: eqSpy });
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({ delete: deleteSpy });

            await dbService.deleteLicitacion('hash123');

            expect(supabase.from).toHaveBeenCalledWith('licitaciones');
            expect(deleteSpy).toHaveBeenCalled();
            expect(eqSpy).toHaveBeenCalledWith('hash', 'hash123');
        });

        it('should throw error if delete fails', async () => {
            const eqSpy = vi.fn().mockResolvedValue({ error: new Error('Delete failed') });
            const deleteSpy = vi.fn().mockReturnValue({ eq: eqSpy });
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({ delete: deleteSpy });

            await expect(dbService.deleteLicitacion('hash123')).rejects.toThrow('Delete failed');
        });
    });

    describe('searchByTags', () => {
        // Since searchByTags fetches all and filters client side, we verify that behavior
        it('should filter results by tag client-side', async () => {
            const mockList = [
                { hash: '1', file_name: 'f1', updated_at: '2023-01-01', data: { metadata: { tags: ['urgent', 'tech'] } } },
                { hash: '2', file_name: 'f2', updated_at: '2023-01-01', data: { metadata: { tags: ['tech'] } } },
                { hash: '3', file_name: 'f3', updated_at: '2023-01-01', data: { metadata: { tags: ['other'] } } }
            ];

            const orderSpy = vi.fn().mockResolvedValue({ data: mockList, error: null });
            const selectSpy = vi.fn().mockReturnValue({ order: orderSpy });
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({ select: selectSpy });

            const results = await dbService.searchByTags(['urgent']);

            expect(results).toHaveLength(1);
            expect(results[0].hash).toBe('1');
        });

        it('should return empty array if no matches', async () => {
            const mockList = [
                { hash: '1', data: { metadata: { tags: ['tech'] } } }
            ] as unknown as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
            // Just cast to proper type if possible, or unknown.
            // But verify: explicit-any is strictly 'as any'.
            // Let's use `as unknown as { hash: string; data: Partial<LicitacionData> }[]`
            // actually the linter likely flag `as any` specifically. `as unknown` is allowed.
            // Let's rely on type inference or use `as unknown`.
            const orderSpy = vi.fn().mockResolvedValue({ data: mockList, error: null });
            const selectSpy = vi.fn().mockReturnValue({ order: orderSpy });
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({ select: selectSpy });

            const results = await dbService.searchByTags(['nonexistent']);
            expect(results).toHaveLength(0);
        });
    });

    describe('getAllLicitaciones', () => {
        it('should fetch all and map correctly', async () => {
            const mockList = [{
                hash: '1',
                file_name: 'f1',
                updated_at: '2023-01-01',
                data: mockData
            }];
            const orderSpy = vi.fn().mockResolvedValue({ data: mockList, error: null });
            const selectSpy = vi.fn().mockReturnValue({ order: orderSpy });
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({ select: selectSpy });

            const results = await dbService.getAllLicitaciones();
            expect(results).toHaveLength(1);
            expect(results[0].hash).toBe('1');
            expect(results[0].data).toEqual(mockData);
            expect(expect(selectSpy).toHaveBeenCalledWith('*'));
            expect(orderSpy).toHaveBeenCalledWith('updated_at', { ascending: false });
        });

        it('should throw error on fetch failure', async () => {
            const orderSpy = vi.fn().mockResolvedValue({ data: null, error: new Error('Get failed') });
            const selectSpy = vi.fn().mockReturnValue({ order: orderSpy });
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({ select: selectSpy });

            await expect(dbService.getAllLicitaciones()).rejects.toThrow('Get failed');
        });
    });

    describe('advancedSearch', () => {
        it('should apply budget filters via Supabase query builder', async () => {
            // Mock chaining
            const filterSpy = vi.fn().mockReturnThis(); // for filter calls

            // Since advancedSearch uses query.filter().filter()... we need the mock to support chain
            // Simulating the query builder promise:
            const queryBuilderMock = {
                select: vi.fn().mockReturnThis(),
                filter: filterSpy,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                then: (onfulfilled: any) => Promise.resolve({ data: [], error: null }).then(onfulfilled)
            };

            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue(queryBuilderMock);

            await dbService.advancedSearch({ presupuestoMin: 100, presupuestoMax: 500 });

            expect(filterSpy).toHaveBeenCalledTimes(2);
            expect(filterSpy).toHaveBeenCalledWith('data->datosGenerales->>presupuesto', 'gte', 100);
            expect(filterSpy).toHaveBeenCalledWith('data->datosGenerales->>presupuesto', 'lte', 500);
        });

        it('should filter by client in memory', async () => {
            const mockDBData = [
                { hash: '1', file_name: 'doc1', updated_at: '2023-01-01', data: { metadata: { cliente: 'Ayuntamiento Madrid' } } },
                { hash: '2', file_name: 'doc2', updated_at: '2023-01-01', data: { metadata: { cliente: 'Gobierno Vasco' } } }
            ];

            const queryBuilderMock = {
                select: vi.fn().mockReturnThis(),
                filter: vi.fn().mockReturnThis(),
                then: (resolve: (value: unknown) => void) => resolve({ data: mockDBData, error: null })
            };
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue(queryBuilderMock);

            const results = await dbService.advancedSearch({ cliente: 'madrid' });
            expect(results).toHaveLength(1);
            expect(results[0].hash).toBe('1');
        });

        it('should filter by status in memory', async () => {
            const mockDBData = [
                { hash: '1', file_name: 'doc1', updated_at: '2023-01-01', data: { metadata: { estado: 'DESCARTADA' } } },
                { hash: '2', file_name: 'doc2', updated_at: '2023-01-01', data: { metadata: { estado: 'PENDIENTE' } } }
            ];

            const queryBuilderMock = {
                select: vi.fn().mockReturnThis(),
                filter: vi.fn().mockReturnThis(),
                then: (resolve: (value: unknown) => void) => resolve({ data: mockDBData, error: null })
            };
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue(queryBuilderMock);

            const results = await dbService.advancedSearch({ estado: 'PENDIENTE' });
            expect(results).toHaveLength(1);
            expect(results[0].hash).toBe('2');
        });

        it('should filter by date range in memory', async () => {
            const mockDBData = [
                { hash: '1', file_name: 'd1', updated_at: '2023-01-01', data: {} },
                { hash: '2', file_name: 'd2', updated_at: '2023-06-01', data: {} },
                { hash: '3', file_name: 'd3', updated_at: '2023-12-01', data: {} }
            ];

            const queryBuilderMock = {
                select: vi.fn().mockReturnThis(),
                filter: vi.fn().mockReturnThis(),
                then: (resolve: (value: unknown) => void) => resolve({ data: mockDBData, error: null })
            };
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue(queryBuilderMock);

            const results = await dbService.advancedSearch({
                fechaDesde: new Date('2023-02-01').getTime(),
                fechaHasta: new Date('2023-10-01').getTime()
            });

            expect(results).toHaveLength(1);
            expect(results[0].hash).toBe('2');
        });
    });
});
