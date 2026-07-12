import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchPage } from '../SearchPage';
import { MemoryRouter } from 'react-router-dom';
import type { SearchFilters } from '../../types';

const { mockAdvancedSearch } = vi.hoisted(() => ({
    mockAdvancedSearch: vi.fn(),
}));

vi.mock('../../config/service-registry', () => ({
    services: {
        db: {
            advancedSearch: mockAdvancedSearch,
        },
    },
}));

// Replace the lazy SearchPanel with a button that triggers a search directly.
vi.mock('../../features/search/SearchPanel', () => ({
    SearchPanel: ({ onSearch }: { onSearch: (filters: SearchFilters) => void }) => (
        <button onClick={() => onSearch({} as SearchFilters)}>Ejecutar búsqueda</button>
    ),
}));

function buildResult(overrides: Record<string, unknown> = {}) {
    return {
        hash: 'hash-1',
        data: {
            datosGenerales: {
                titulo: 'Servicio de limpieza',
                presupuesto: 10000,
                moneda: 'EUR',
                ...overrides,
            },
            metadata: { tags: [] },
        },
    };
}

async function searchWith() {
    render(
        <MemoryRouter>
            <SearchPage />
        </MemoryRouter>
    );
    fireEvent.click(await screen.findByText('Ejecutar búsqueda'));
}

describe('SearchPage', () => {
    beforeEach(() => {
        mockAdvancedSearch.mockReset();
    });

    it('renders results with formatted budget', async () => {
        mockAdvancedSearch.mockResolvedValue({ ok: true, value: [buildResult()] });
        await searchWith();

        await waitFor(() => {
            expect(screen.getByText('Servicio de limpieza')).toBeInTheDocument();
        });
        expect(screen.getByText(/10\.000,00/)).toBeInTheDocument();
    });

    it('does not crash when currency and budget are missing (renders a dash)', async () => {
        mockAdvancedSearch.mockResolvedValue({
            ok: true,
            value: [buildResult({ presupuesto: undefined, moneda: undefined })],
        });
        await searchWith();

        await waitFor(() => {
            expect(screen.getByText('Servicio de limpieza')).toBeInTheDocument();
        });
        expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('shows an empty state after a search with no results', async () => {
        mockAdvancedSearch.mockResolvedValue({ ok: true, value: [] });
        await searchWith();

        await waitFor(() => {
            expect(screen.getByText('Sin resultados')).toBeInTheDocument();
        });
    });

    it('surfaces search errors to the user', async () => {
        mockAdvancedSearch.mockResolvedValue({ ok: false, error: new Error('boom') });
        await searchWith();

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('No se pudo completar la búsqueda');
        });
    });
});
