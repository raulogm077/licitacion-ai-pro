
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dashboard } from '../Dashboard';
import { LicitacionData } from '../../../types';

// Mock Lucide icons
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
    TrendingUp: () => <span data-testid="icon-trending-up" />,
    Clock: () => <span data-testid="icon-clock" />,
    FileText: () => <span data-testid="icon-file-text" />,
    Users: () => <span data-testid="icon-users" />,
    Tag: () => <span data-testid="icon-tag" />,
    PieChart: () => <span data-testid="icon-pie-chart" />,
    BarChart3: () => <span data-testid="icon-bar-chart" />,
}));

// Mock Child Components
vi.mock('../../../components/ui/Card', () => ({
    Card: ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={className}>{children}</div>,
    CardContent: ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={className}>{children}</div>,
    CardHeader: ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={className}>{children}</div>,
    CardTitle: ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock('../../../components/ui/Badge', () => ({
    Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('../RequirementsMatrix', () => ({
    RequirementsMatrix: () => <div data-testid="requirements-matrix">Matrix</div>,
}));

const mockData: LicitacionData = {
    datosGenerales: {
        titulo: 'Licitación de Prueba',
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
    it('renders without crashing and displays title', () => {
        render(
            <Dashboard
                data={mockData}
                onUpdate={() => { }}
            />
        );

        expect(screen.getByText('Licitación de Prueba')).toBeInTheDocument();
        expect(screen.getByText(/100\.000.*€/)).toBeInTheDocument(); // Format currency check
    });
});
