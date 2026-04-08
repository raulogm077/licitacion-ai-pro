import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryPage } from '../HistoryPage';
import { MemoryRouter } from 'react-router-dom';
import { useAnalysisStore } from '../../stores/analysis.store';

const { mockGetAll, mockNavigate, mockSubscribeToLicitacion } = vi.hoisted(() => ({
    mockGetAll: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    mockNavigate: vi.fn(),
    mockSubscribeToLicitacion: vi.fn().mockReturnValue({ unsubscribe: vi.fn() })
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...(actual as any),
        useNavigate: () => mockNavigate
    };
});

vi.mock('../../config/service-registry', () => ({
    services: {
        db: {
            getAllLicitaciones: mockGetAll,
            subscribeToLicitacion: mockSubscribeToLicitacion
        },
    },
}));

vi.mock('../../features/history/HistoryView', () => {
    return {
        HistoryView: ({ onSelect }: any) => (
            <div data-testid="mock-history-view">
                Mock History View
                <button onClick={() => onSelect({ id: 'test' }, 'hash-test')}>Select</button>
            </div>
        ),
    };
});

describe('HistoryPage', () => {
    beforeEach(() => {
        mockGetAll.mockReset();
        mockGetAll.mockResolvedValue({ ok: true, value: [] });
    });

    it('renders history list', async () => {
        render(
            <MemoryRouter>
                <HistoryPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('mock-history-view')).toBeInTheDocument();
        });
    });

    it('handles selection correctly', async () => {
        render(
            <MemoryRouter>
                <HistoryPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('mock-history-view')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
        expect(mockNavigate).toHaveBeenCalledWith('/');
        expect(useAnalysisStore.getState().status).toBe('COMPLETED');
    });
});
