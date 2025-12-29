
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

const mockData: LicitacionData = {
    datosGenerales: {
        titulo: 'Licitación de Prueba Smoke',
        organoContratacion: 'Ministerio de Prueba',
        presupuesto: 100000,
        moneda: 'EUR',
        plazoEjecucionMeses: 12,
        cpv: ['72000000-5'],

    },
    criteriosAdjudicacion: {
        objetivos: [],
        subjetivos: []
    },
    requisitosTecnicos: {
        funcionales: [],
        normativa: []
    },
    requisitosSolvencia: {
        economica: { cifraNegocioAnualMinima: 0, descripcion: '' },
        tecnica: []
    },
    restriccionesYRiesgos: {
        killCriteria: [],
        riesgos: [],
        penalizaciones: []
    },
    modeloServicio: {
        sla: [],
        equipoMinimo: []
    }
};

describe('Dashboard Smoke Test', () => {
    it('renders without crashing', () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} onUpdate={() => { }} />
            </MemoryRouter>
        );

        expect(screen.getAllByText('Licitación de Prueba Smoke')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Ministerio de Prueba')[0]).toBeInTheDocument();
    });
});
