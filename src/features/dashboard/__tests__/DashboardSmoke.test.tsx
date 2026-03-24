
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dashboard } from '../Dashboard';
import { MemoryRouter } from 'react-router-dom';
import { LicitacionData } from '../../../types';

// Mock Lucide icons
vi.mock("lucide-react", () => ({
    Menu: () => <span data-testid="icon-menu" />,
    X: () => <span data-testid="icon-x" />,
    Search: () => <span data-testid="icon-search" />,
    LogOut: () => <span data-testid="icon-logout" />,
    ChevronDown: () => <span data-testid="icon-chevron-down" />,
    ChevronRight: () => <span data-testid="icon-chevron-right" />,
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
    Pin: () => <span data-testid="icon-pin" />,
    PinOff: () => <span data-testid="icon-pin-off" />,
    FileSearch: () => <span data-testid="icon-file-search" />,
    LayoutDashboard: () => <span data-testid="icon-layout-dashboard" />,
    Award: () => <span data-testid="icon-award" />,
    Shield: () => <span data-testid="icon-shield" />,
    Wrench: () => <span data-testid="icon-wrench" />,
    Settings: () => <span data-testid="icon-settings" />,
    Building2: () => <span data-testid="icon-building" />,
    Euro: () => <span data-testid="icon-euro" />,
    CalendarClock: () => <span data-testid="icon-calendar" />,
    Timer: () => <span data-testid="icon-timer" />,
    TrendingUp: () => <span data-testid="icon-trending" />,
    Sparkles: () => <span data-testid="icon-sparkles" />,
    MapPin: () => <span data-testid="icon-pin-2" />,
    Users: () => <span data-testid="icon-users" />,
    Layers: () => <span data-testid="icon-layers" />,
    Tag: () => <span data-testid="icon-tag" />,
    BarChart2: () => <span data-testid="icon-chart" />,
    ShieldAlert: () => <span data-testid="icon-shield-alert" />,
    Info: () => <span data-testid="icon-info" />,
    CheckCircle2: () => <span data-testid="icon-check2" />,
    Bell: () => <span data-testid="icon-bell" />,
    ArrowRight: () => <span data-testid="icon-arrow" />,
    ThumbsUp: () => <span data-testid="icon-thumbsup" />,
    ThumbsDown: () => <span data-testid="icon-thumbsdown" />
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
