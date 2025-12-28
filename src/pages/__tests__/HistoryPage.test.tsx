import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryPage } from '../HistoryPage';

// Mock dependencies
// Mock dependencies using hoisted variable to verify different states
const { mockGetAll } = vi.hoisted(() => ({
    mockGetAll: vi.fn()
}));

vi.mock('../../services/db.service', () => ({
    dbService: {
        getAllLicitaciones: mockGetAll
    }
}));

import { MemoryRouter } from 'react-router-dom';

describe('HistoryPage', () => {
    beforeEach(() => {
        mockGetAll.mockReset();
    });

    it('renders history list', async () => {
        mockGetAll.mockResolvedValue([
            {
                hash: '1',
                fileName: 'test.pdf',
                timestamp: Date.now(),
                data: { datosGenerales: { titulo: 'Test History', presupuesto: 100 } }
            }
        ]);

        render(
            <MemoryRouter>
                <HistoryPage onSelect={vi.fn()} />
            </MemoryRouter>
        );

        expect(await screen.findByText('Test History')).toBeInTheDocument();
        expect(screen.getByText('Historial de Análisis')).toBeInTheDocument();
    });

    it('shows empty state if no data', async () => {
        mockGetAll.mockResolvedValue([]);

        render(
            <MemoryRouter>
                <HistoryPage onSelect={vi.fn()} />
            </MemoryRouter>
        );

        expect(await screen.findByText(/No hay historial/i)).toBeInTheDocument();
        expect(screen.getByText(/Los documentos analizados aparecerán aquí/i)).toBeInTheDocument();
    });
});

