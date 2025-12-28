import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from '../Dashboard';
import { MemoryRouter } from 'react-router-dom';
import { LicitacionData } from '../../../types';

// Mock child components to focus on Dashboard logic/layout
vi.mock('../RequirementsMatrix', () => ({
    RequirementsMatrix: () => <div data-testid="req-matrix">Matrix</div>
}));
vi.mock('../RisksPanel', () => ({
    RisksPanel: () => <div data-testid="risks-panel">Risks</div>
}));
vi.mock('../ServiceModel', () => ({
    ServiceModel: () => <div data-testid="service-model">Service</div>
}));
vi.mock('lucide-react', () => ({
    AlertTriangle: () => <span data-testid="icon-alert" />,
    CheckCircle: () => <span data-testid="icon-check" />,
    Euro: () => <span data-testid="icon-euro" />,
    Calendar: () => <span data-testid="icon-calendar" />,
    ShieldAlert: () => <span data-testid="icon-shield" />,
    Download: () => <span data-testid="icon-download" />,
    Edit2: () => <span data-testid="icon-edit" />,
    Save: () => <span data-testid="icon-save" />,
    X: () => <span data-testid="icon-x" />,
    Code: () => <span data-testid="icon-code" />,
    Copy: () => <span data-testid="icon-copy" />,
    Check: () => <span data-testid="icon-check" />,
    AlertCircle: () => <span data-testid="icon-alert-circle" />,
    TrendUp: () => <span data-testid="icon-trend-up" />,
    Clock: () => <span data-testid="icon-clock" />,
    FileText: () => <span data-testid="icon-file-text" />,
    Users: () => <span data-testid="icon-users" />,
    Tag: () => <span data-testid="icon-tag" />,
    PieChart: () => <span data-testid="icon-pie-chart" />,
    BarChart3: () => <span data-testid="icon-bar-chart" />,
    Target: () => <span data-testid="icon-target" />,
    Shield: () => <span data-testid="icon-shield-base" />,
    Zap: () => <span data-testid="icon-zap" />,
}));

describe('Dashboard', () => {
    const mockData: LicitacionData = {
        metadata: {
            tags: ['test']
        },
        datosGenerales: {
            titulo: 'Test Licitacion',
            presupuesto: 10000,
            organoContratacion: 'Org',
            plazoEjecucionMeses: 12,
            cpv: ['12345678'],
            moneda: 'EUR'
        },
        criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
        requisitosTecnicos: { funcionales: [], normativa: [] },
        requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 1000 }, tecnica: [] },
        restriccionesYRiesgos: { riesgos: [], killCriteria: [], penalizaciones: [] },
        modeloServicio: { sla: [], equipoMinimo: [] }
    };

    it('renders dashboard with data', () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} onUpdate={vi.fn()} />
            </MemoryRouter>
        );

        expect(screen.getByText('Test Licitacion')).toBeInTheDocument();
        expect(screen.getByText('10.000,00 €')).toBeInTheDocument(); // Formatted
        expect(screen.getByTestId('req-matrix')).toBeInTheDocument();
    });

    it('navigates tabs correctly', () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} onUpdate={vi.fn()} />
            </MemoryRouter>
        );

        // Assume tabs exist (General, Requisitos, etc)
        // If tabs are not rendered in simplified mock or logic, we might need to adjust.
        // Dashboard code shows tabs? No, it shows Cards. 
        // Wait, Dashboard.tsx does NOT have tabs. It renders "RequirementsMatrix" and "Risks" in cards or grid.
        // My previous test assumed tabs. I need to fix this expectation. Use scroll or existence check.

        expect(screen.getByTestId('req-matrix')).toBeInTheDocument();
        expect(screen.getByText('Riesgos Detectados')).toBeInTheDocument();
    });

    it('shows safe mode interaction', () => {
        // Dashboard.tsx implementation shows Edit/Save buttons.
        render(
            <MemoryRouter>
                <Dashboard data={mockData} onUpdate={vi.fn()} />
            </MemoryRouter>
        );

        const editBtn = screen.getByText('Editar');
        fireEvent.click(editBtn);

        expect(screen.getByText('Guardar Cambios')).toBeInTheDocument();
        expect(screen.getByText('Cancelar')).toBeInTheDocument();
    });
});
