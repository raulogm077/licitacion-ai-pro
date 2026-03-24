import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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

    it('renders header and sidebar nav', () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} />
            </MemoryRouter>
        );

        // Header
        expect(screen.getAllByText('Test Org')[0]).toBeInTheDocument();
        // Sidebar items
        expect(screen.getAllByText('Resumen Ejecutivo')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Datos Generales')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Criterios de Adjudicación')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Solvencia')[0]).toBeInTheDocument();
    });

    // Note: Drawer interaction is hard to test if purely controlled by state without aria-expanded or similar, 
    // but we can check if the button to toggle it exists or if we can find the drawer content when "pinned" or "open".
    // Since we mocked Lucide icons, we can look for "icon-more" which opens the actions menu.

    it('renders export buttons in header', () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} />
            </MemoryRouter>
        );

        expect(screen.getByText('Exportar Reporte')).toBeInTheDocument();
        expect(screen.getByText('Ver Original')).toBeInTheDocument();
    });
});
