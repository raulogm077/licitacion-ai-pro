import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLicitacionStore } from '../licitacion.store';
import { services } from '../../config/service-registry';
import { LicitacionData } from '../../types';

vi.mock('../../config/service-registry', () => ({
    services: {
        db: {
            updateLicitacion: vi.fn(),
            subscribeToLicitacion: vi.fn(),
        },
    },
}));

vi.mock('../../services/logger', () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockLicitacionData = {
    result: {
        datosGenerales: {
            titulo: 'Test',
            presupuesto: 1000,
            moneda: 'EUR',
            plazoEjecucionMeses: 12,
            cpv: ['123'],
            organoContratacion: 'Test Org',
        },
        criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
        requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [] },
        requisitosTecnicos: { funcionales: [], normativa: [] },
        restriccionesYRiesgos: { riesgos: [], killCriteria: [], penalizaciones: [] },
        modeloServicio: { sla: [], equipoMinimo: [] },
    },
    versions: [],
    workflow: { current_version: 1, status: 'succeeded', steps: [], evidences: [], updated_at: '' },
    metadata: { tags: [] },
    notas: [],
};

describe('Licitacion Store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useLicitacionStore.getState().reset();
    });

    describe('loadLicitacion', () => {
        it('should load data with hash', () => {
            const mockChannel = { unsubscribe: vi.fn() };
            vi.mocked(services.db.subscribeToLicitacion).mockReturnValue(
                mockChannel as unknown as ReturnType<typeof services.db.subscribeToLicitacion>
            );

            useLicitacionStore.getState().loadLicitacion(mockLicitacionData as unknown as LicitacionData, 'hash123');

            const state = useLicitacionStore.getState();
            expect(state.data).toBeTruthy();
            expect(state.hash).toBe('hash123');
            expect(services.db.subscribeToLicitacion).toHaveBeenCalledWith('hash123', expect.any(Function));
        });

        it('should load data without hash (local mode)', () => {
            useLicitacionStore.getState().loadLicitacion(mockLicitacionData as unknown as LicitacionData);

            const state = useLicitacionStore.getState();
            expect(state.data).toBeTruthy();
            expect(state.hash).toBeUndefined();
            expect(services.db.subscribeToLicitacion).not.toHaveBeenCalled();
        });

        it('should unsubscribe previous channel on reload', () => {
            const mockChannel = { unsubscribe: vi.fn() };
            useLicitacionStore.setState({ activeChannel: mockChannel as unknown as null });

            useLicitacionStore.getState().loadLicitacion(mockLicitacionData as unknown as LicitacionData);

            expect(mockChannel.unsubscribe).toHaveBeenCalled();
        });
    });

    describe('updateData', () => {
        it('should update locally when no hash (local mode)', async () => {
            useLicitacionStore.setState({ data: mockLicitacionData as unknown as null, hash: undefined });

            const newData = { ...mockLicitacionData, metadata: { tags: ['updated'] } };
            const result = await useLicitacionStore.getState().updateData(newData as unknown as LicitacionData);

            expect(result).toBe(true);
            expect(useLicitacionStore.getState().isSaving).toBe(false);
        });

        it('should persist to DB when hash exists', async () => {
            useLicitacionStore.setState({ data: mockLicitacionData as unknown as null, hash: 'hash123' });
            vi.mocked(services.db.updateLicitacion).mockResolvedValue({ ok: true, value: undefined });

            const newData = { ...mockLicitacionData, metadata: { tags: ['updated'] } };
            const result = await useLicitacionStore.getState().updateData(newData as unknown as LicitacionData);

            expect(result).toBe(true);
            expect(services.db.updateLicitacion).toHaveBeenCalledWith('hash123', expect.anything());
        });

        it('should rollback on DB error', async () => {
            const originalData = { ...mockLicitacionData };
            useLicitacionStore.setState({ data: originalData as unknown as null, hash: 'hash123' });
            vi.mocked(services.db.updateLicitacion).mockResolvedValue({
                ok: false,
                error: { message: 'DB Error' },
            } as unknown as Awaited<ReturnType<typeof services.db.updateLicitacion>>);

            const newData = { ...mockLicitacionData, metadata: { tags: ['bad'] } };
            const result = await useLicitacionStore.getState().updateData(newData as unknown as LicitacionData);

            expect(result).toBe(false);
            expect(useLicitacionStore.getState().saveError).toContain('Error guardando');
        });

        it('should rollback on exception', async () => {
            useLicitacionStore.setState({ data: mockLicitacionData as unknown as null, hash: 'hash123' });
            vi.mocked(services.db.updateLicitacion).mockRejectedValue(new Error('Network'));

            const newData = { ...mockLicitacionData };
            const result = await useLicitacionStore.getState().updateData(newData as unknown as LicitacionData);

            expect(result).toBe(false);
            expect(useLicitacionStore.getState().saveError).toContain('inesperado');
        });
    });

    describe('reset', () => {
        it('should reset all state and unsubscribe channel', () => {
            const mockChannel = { unsubscribe: vi.fn() };
            useLicitacionStore.setState({
                data: mockLicitacionData as unknown as null,
                hash: 'hash123',
                isSaving: true,
                saveError: 'some error',
                activeChannel: mockChannel as unknown as null,
            });

            useLicitacionStore.getState().reset();

            const state = useLicitacionStore.getState();
            expect(state.data).toBeNull();
            expect(state.hash).toBeUndefined();
            expect(state.isSaving).toBe(false);
            expect(state.saveError).toBeNull();
            expect(mockChannel.unsubscribe).toHaveBeenCalled();
        });
    });
});
