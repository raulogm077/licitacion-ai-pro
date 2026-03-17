import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryPage } from '../HistoryPage';
import { MemoryRouter } from 'react-router-dom';

const { mockGetAll } = vi.hoisted(() => ({
    mockGetAll: vi.fn().mockResolvedValue({ ok: true, value: [] })
}));

vi.mock('../../config/service-registry', () => ({
    services: {
        db: {
            getAllLicitaciones: mockGetAll
        }
    }
}));

// We must mock the lazy import because it's asynchronous
vi.mock('../../features/history/HistoryView', () => {
    return {
        HistoryView: () => <div data-testid="mock-history-view">Mock History View</div>
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
});
