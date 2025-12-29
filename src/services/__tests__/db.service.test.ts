import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { dbService } from '../db.service';
import { supabase } from '../../config/supabase';
import { LicitacionData } from '../../types';

// Mock Supabase
// Mock Supabase
const { selectSpy, filterSpy, upsertSpy, authSpy, containsSpy, ilikeSpy, gteSpy, lteSpy } = vi.hoisted(() => ({
    selectSpy: vi.fn(),
    filterSpy: vi.fn(),
    upsertSpy: vi.fn(),
    containsSpy: vi.fn(),
    ilikeSpy: vi.fn(),
    gteSpy: vi.fn(),
    lteSpy: vi.fn(),
    authSpy: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } }, error: null })
    }
}));

vi.mock('../../config/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: selectSpy,
            insert: vi.fn().mockReturnThis(),
            upsert: upsertSpy,
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            filter: filterSpy,
            contains: containsSpy,
            ilike: ilikeSpy,
            gte: gteSpy,
            lte: lteSpy
        })),
        auth: authSpy
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
        // Reset global spies for each test
        selectSpy.mockClear();
        filterSpy.mockClear();
        upsertSpy.mockClear();
        ilikeSpy.mockClear();
        gteSpy.mockClear();
        lteSpy.mockClear();
        authSpy.getSession.mockClear();
        // Ensure default mockReturnThis behavior for chained methods
        selectSpy.mockReturnThis();
        filterSpy.mockReturnThis();
        upsertSpy.mockReturnThis();
        ilikeSpy.mockReturnThis();
        gteSpy.mockReturnThis();
        lteSpy.mockReturnThis();
    });

    describe('saveLicitacion', () => {
        it('should call upsert with correct params', async () => {
            upsertSpy.mockResolvedValue({ error: null });
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({
                upsert: upsertSpy
            });

            const result = await dbService.saveLicitacion('hash123', 'test.pdf', mockData);

            expect(result.ok).toBe(true);
            expect(supabase.from).toHaveBeenCalledWith('licitaciones');
            expect(upsertSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    hash: 'hash123',
                    file_name: 'test.pdf',
                    data: expect.anything()
                }),
                expect.objectContaining({ onConflict: 'user_id, hash' })
            );
        });

        it('should return error result if upsert fails', async () => {
            upsertSpy.mockResolvedValue({ error: { message: 'DB Error', code: '500' } });
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({
                upsert: upsertSpy
            });

            const result = await dbService.saveLicitacion('hash123', 'test.pdf', mockData);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe('DB Error');
            }
        });

        it('should return error if no session active', async () => {
            authSpy.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });

            const result = await dbService.saveLicitacion('hash123', 'test.pdf', mockData);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('No hay sesión activa');
            }
        });
    });

    describe('getLicitacion', () => {
        it('should return successful result with data when found', async () => {
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
            selectSpy.mockReturnValue({ eq: eqSpy });

            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({ select: selectSpy });

            const result = await dbService.getLicitacion('hash123');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.hash).toBe('hash123');
                expect(result.value.fileName).toBe('test.pdf');
                expect(result.value.data).toEqual(mockData);
            }
        });

        it('should return error result if not found', async () => {
            const mockResponse = { data: null, error: { message: 'Not found' } };
            const singleSpy = vi.fn().mockResolvedValue(mockResponse);
            const eqSpy = vi.fn().mockReturnValue({ single: singleSpy });
            selectSpy.mockReturnValue({ eq: eqSpy });

            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({ select: selectSpy });

            const result = await dbService.getLicitacion('hash123');
            expect(result.ok).toBe(false);
        });
    });

    describe('getAllLicitaciones', () => {
        it('should fetch all and return successful result', async () => {
            const mockList = [{
                hash: '1',
                file_name: 'f1',
                updated_at: '2023-01-01T00:00:00Z',
                data: mockData
            }];
            const orderSpy = vi.fn().mockResolvedValue({ data: mockList, error: null });
            selectSpy.mockReturnValue({ order: orderSpy });
            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({ select: selectSpy });

            const result = await dbService.getAllLicitaciones();
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toHaveLength(1);
                expect(result.value[0].hash).toBe('1');
            }
        });
    });

    describe('advancedSearch', () => {
        it('should apply budget filters and return successful result', async () => {
            const mockLicitaciones = [
                { hash: '1', file_name: 'doc1', updated_at: '2023-01-01T00:00:00Z', data: { metadata: { cliente: 'A', estado: 'ABIERTA' }, datosGenerales: { presupuesto: 200 } } }
            ];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const thenMock = (onfulfilled: (value: { data: any[] | null; error: any }) => any) => Promise.resolve({ data: mockLicitaciones, error: null }).then(onfulfilled);
            selectSpy.mockReturnValue({
                filter: filterSpy,
                then: thenMock
            });

            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({ select: selectSpy });

            const result = await dbService.advancedSearch({ presupuestoMin: 100 });

            expect(result.ok).toBe(true);
            expect(filterSpy).toHaveBeenCalledWith('data->datosGenerales->>presupuesto', 'gte', 100);
        });

        it('should filter by client using SQL ilike', async () => {
            const mockDBData = [
                { hash: '1', updated_at: '2023-01-01T00:00:00Z', data: { metadata: { cliente: 'Madrid' } } }
            ];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const thenMock = (onfulfilled: (value: { data: any[] | null; error: any }) => any) => Promise.resolve({ data: mockDBData, error: null }).then(onfulfilled);

            // Mock the chain: select -> ilike -> then
            const mockChain = {
                filter: filterSpy,
                ilike: ilikeSpy,
                gte: gteSpy,
                lte: lteSpy,
                then: thenMock
            };

            selectSpy.mockReturnValue(mockChain);
            ilikeSpy.mockReturnValue(mockChain); // chainable

            (vi.mocked(supabase.from) as unknown as Mock).mockReturnValue({ select: selectSpy });

            const result = await dbService.advancedSearch({ cliente: 'madrid' });
            expect(result.ok).toBe(true);
            expect(ilikeSpy).toHaveBeenCalledWith('data->metadata->>cliente', '%madrid%');

            // Since we mocked the return to be just the 1 matching item (simulating DB work),
            // and we rely on DB to filter, we verify the RESULT matches what DB returned.
            if (result.ok) {
                expect(result.value).toHaveLength(1);
                expect(result.value[0].hash).toBe('1');
            }
        });
    });
});
