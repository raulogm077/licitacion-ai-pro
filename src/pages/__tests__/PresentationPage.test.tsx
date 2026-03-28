import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PresentationPage } from '../PresentationPage';
import { MemoryRouter } from 'react-router-dom';
import { LicitacionData } from '../../types';

// Mock PresentationMode (lazy loaded)
vi.mock('../../features/presentation/PresentationMode', () => ({
    PresentationMode: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="presentation-mode">
            <h1>Presentation Mode</h1>
            <button onClick={onClose}>Close</button>
        </div>
    ),
}));

describe('PresentationPage', () => {
    it('renders message when no data', () => {
        render(
            <MemoryRouter>
                <PresentationPage data={null} />
            </MemoryRouter>
        );
        expect(screen.getByText('No data to present')).toBeInTheDocument();
    });

    it('renders PresentationMode when data available', async () => {
        const mockData = { datosGenerales: { titulo: 'Test' } } as unknown as LicitacionData;
        render(
            <MemoryRouter>
                <PresentationPage data={mockData} />
            </MemoryRouter>
        );

        expect(await screen.findByTestId('presentation-mode')).toBeInTheDocument();
    });
});
