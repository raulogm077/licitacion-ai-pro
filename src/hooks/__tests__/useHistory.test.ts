import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHistory } from '../useHistory';

// Mock service-registry to isolate the hook from the actual DB service
vi.mock('../../config/service-registry', () => ({
    services: {
        db: {
            getAllLicitaciones: vi.fn(),
            advancedSearch: vi.fn(),
            searchLicitaciones: vi.fn(),
            deleteLicitacion: vi.fn(),
        },
    },
}));

// Mock logger to avoid side effects
vi.mock('../../services/logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

import { services } from '../../config/service-registry';

const mockDb = services.db as unknown as {
    getAllLicitaciones: ReturnType<typeof vi.fn>;
    advancedSearch: ReturnType<typeof vi.fn>;
    searchLicitaciones: ReturnType<typeof vi.fn>;
    deleteLicitacion: ReturnType<typeof vi.fn>;
};

const sampleItem = {
    hash: 'abc123',
    fileName: 'pliego.pdf',
    timestamp: 2000,
    data: {} as never,
};

describe('useHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads history on mount', async () => {
        mockDb.getAllLicitaciones.mockResolvedValue({ ok: true, value: [sampleItem] });

        const { result } = renderHook(() => useHistory());

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(mockDb.getAllLicitaciones).toHaveBeenCalledTimes(1);
        expect(result.current.items).toHaveLength(1);
        expect(result.current.items[0].hash).toBe('abc123');
    });

    it('sets error when history load fails', async () => {
        mockDb.getAllLicitaciones.mockResolvedValue({ ok: false, error: 'DB error' });

        const { result } = renderHook(() => useHistory());

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBe('Error al cargar el historial. Por favor intente nuevamente.');
        expect(result.current.items).toHaveLength(0);
    });

    it('uses advancedSearch when filters are provided', async () => {
        mockDb.getAllLicitaciones.mockResolvedValue({ ok: true, value: [] });
        mockDb.advancedSearch.mockResolvedValue({ ok: true, value: [sampleItem] });

        const { result } = renderHook(() => useHistory());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.applyFilters({ presupuestoMin: 1000 });
        });

        expect(mockDb.advancedSearch).toHaveBeenCalledWith({ presupuestoMin: 1000 });
    });

    it('calls getAllLicitaciones when empty query is searched', async () => {
        mockDb.getAllLicitaciones.mockResolvedValue({ ok: true, value: [] });

        const { result } = renderHook(() => useHistory());
        await waitFor(() => expect(result.current.loading).toBe(false));

        mockDb.getAllLicitaciones.mockClear();
        mockDb.getAllLicitaciones.mockResolvedValue({ ok: true, value: [] });

        await act(async () => {
            await result.current.search('');
        });

        expect(mockDb.getAllLicitaciones).toHaveBeenCalled();
        expect(mockDb.searchLicitaciones).not.toHaveBeenCalled();
    });

    it('debounces search calls — does not call searchLicitaciones immediately', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        mockDb.getAllLicitaciones.mockResolvedValue({ ok: true, value: [] });
        mockDb.searchLicitaciones.mockResolvedValue({ ok: true, value: [] });

        const { result } = renderHook(() => useHistory());

        // Wait for initial load using a manual flag (avoids waitFor + fake timers conflict)
        await act(async () => {
            await Promise.resolve(); // flush microtasks
        });

        act(() => {
            result.current.search('pliego');
        });

        // searchLicitaciones should NOT have been called yet (within debounce window)
        expect(mockDb.searchLicitaciones).not.toHaveBeenCalled();

        // Advance past debounce window and flush all timers
        await act(async () => {
            vi.advanceTimersByTime(400);
            await Promise.resolve(); // flush microtasks
        });

        expect(mockDb.searchLicitaciones).toHaveBeenCalledWith('pliego');
        vi.useRealTimers();
    });

    it('removes deleted item from state on successful deletion', async () => {
        mockDb.getAllLicitaciones.mockResolvedValue({ ok: true, value: [sampleItem] });
        mockDb.deleteLicitacion.mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useHistory());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.items).toHaveLength(1);

        await act(async () => {
            await result.current.deleteLicitacion('abc123');
        });

        expect(result.current.items).toHaveLength(0);
        expect(result.current.deleting).toBeNull();
    });

    it('sets error on failed deletion', async () => {
        mockDb.getAllLicitaciones.mockResolvedValue({ ok: true, value: [sampleItem] });
        mockDb.deleteLicitacion.mockResolvedValue({ ok: false, error: 'Delete failed' });

        const { result } = renderHook(() => useHistory());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.deleteLicitacion('abc123');
        });

        expect(result.current.error).toBe('Error al eliminar el registro.');
        // Item should remain in the list
        expect(result.current.items).toHaveLength(1);
    });

    it('sorts items by timestamp descending on load', async () => {
        const older = { ...sampleItem, hash: 'older', timestamp: 1000 };
        const newer = { ...sampleItem, hash: 'newer', timestamp: 2000 };
        mockDb.getAllLicitaciones.mockResolvedValue({ ok: true, value: [older, newer] });

        const { result } = renderHook(() => useHistory());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.items[0].hash).toBe('newer');
        expect(result.current.items[1].hash).toBe('older');
    });
});
