import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from '../Dashboard';
import { MemoryRouter } from 'react-router-dom';
import { LicitacionData } from '../../../types';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    ChevronLeft: () => <span data-testid="icon-chevron-left" />,
    MoreHorizontal: () => <span data-testid="icon-more" />,
    FileText: () => <span data-testid="icon-file-text" />,
    File: () => <span data-testid="icon-file" />,
    Download: () => <span data-testid="icon-download" />,
    AlertCircle: () => <span data-testid="icon-alert-circle" />,
    AlertTriangle: () => <span data-testid="icon-alert-triangle" />,
    Check: () => <span data-testid="icon-check" />,
    XCircle: () => <span data-testid="icon-x-circle" />,
    Copy: () => <span data-testid="icon-copy" />,
    FileJson: () => <span data-testid="icon-file-json" />,
    X: () => <span data-testid="icon-x" />,
    Pin: () => <span data-testid="icon-pin" />,
    PinOff: () => <span data-testid="icon-pin-off" />,
    FileSearch: () => <span data-testid="icon-file-search" />
}));

describe('Dashboard Interaction', () => {
    const mockData: LicitacionData = {
        metadata: { tags: ['test'] },
        datosGenerales: {
            titulo: 'Test Licitacion Interaction',
            presupuesto: 50000,
            organoContratacion: 'Test Org',
            plazoEjecucionMeses: 6,
            cpv: ['12345678'],
            moneda: 'EUR'
        },
        criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
        requisitosTecnicos: { funcionales: [], normativa: [] },
        requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 1000 }, tecnica: [] },
        restriccionesYRiesgos: { riesgos: [], killCriteria: [], penalizaciones: [] },
        modeloServicio: { sla: [], equipoMinimo: [] }
    };

    it('renders header and subnav', () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} />
            </MemoryRouter>
        );

        expect(screen.getAllByText('Test Licitacion Interaction')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Test Org')[0]).toBeInTheDocument();
        // Subnav items
        expect(screen.getByText('Resumen')).toBeInTheDocument();
        expect(screen.getAllByText('Datos Generales')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Criterios')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Solvencia')[0]).toBeInTheDocument();
    });

    // Note: Drawer interaction is hard to test if purely controlled by state without aria-expanded or similar, 
    // but we can check if the button to toggle it exists or if we can find the drawer content when "pinned" or "open".
    // Since we mocked Lucide icons, we can look for "icon-more" which opens the actions menu.

    it('opens actions menu in header', async () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} />
            </MemoryRouter>
        );

        const menuTrigger = screen.getByTestId('actions-menu-trigger'); // ensure we added this testid in previous edits
        fireEvent.click(menuTrigger);

        await waitFor(() => {
            expect(screen.getByText('Exportar Excel')).toBeInTheDocument();
            expect(screen.getByText('Exportar JSON')).toBeInTheDocument();
        });
    });
});
