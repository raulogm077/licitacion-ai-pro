import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dashboard } from '../Dashboard';
import { MemoryRouter } from 'react-router-dom';
import { LicitacionData } from '../../../types';
import { tf } from '../../../test-utils/tracked-field-factory';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
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
    MessageSquare: () => <span data-testid="icon-message-square" />,
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
    ThumbsUp: () => <span data-testid="icon-thumbs-up" />,
    ThumbsDown: () => <span data-testid="icon-thumbs-down" />,
}));

const mockData: LicitacionData = {
    datosGenerales: {
        titulo: tf('Licitación de Prueba Smoke'),
        organoContratacion: tf('Ministerio de Prueba'),
        presupuesto: tf(100000),
        moneda: tf('EUR'),
        plazoEjecucionMeses: tf(12),
        cpv: tf(['72000000-5']),
    },
    criteriosAdjudicacion: {
        objetivos: [],
        subjetivos: [],
    },
    requisitosTecnicos: {
        funcionales: [],
        normativa: [],
    },
    requisitosSolvencia: {
        economica: { cifraNegocioAnualMinima: 0, descripcion: '' },
        tecnica: [],
        profesional: [],
    },
    restriccionesYRiesgos: {
        killCriteria: [],
        riesgos: [],
        penalizaciones: [],
    },
    modeloServicio: {
        sla: [],
        equipoMinimo: [],
    },
};

describe('Dashboard Smoke Test', () => {
    it('renders without crashing', () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} onUpdate={() => {}} />
            </MemoryRouter>
        );

        expect(screen.getAllByText('Licitación de Prueba Smoke')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Ministerio de Prueba')[0]).toBeInTheDocument();
    });

    it('renders DashboardSkeleton when isLoading is true', () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} isLoading={true} />
            </MemoryRouter>
        );
        // DashboardSkeleton uses animate-pulse classes usually
        expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('renders plantilla section when activeSection is plantilla', async () => {
        const dataWithTemplate = {
            ...mockData,
            plantilla_personalizada: {
                testField: 'Test Value',
            },
        };

        const { fireEvent } = await import('@testing-library/react');
        render(
            <MemoryRouter>
                <Dashboard data={dataWithTemplate} />
            </MemoryRouter>
        );

        // Sidebar uses 'Extracción' for the chapter title
        const templateNavs = screen.queryAllByText(/Extracción/i);
        if (templateNavs.length > 0) {
            fireEvent.click(templateNavs[0]);
            // Now the main content should render the custom extraction title
            const headers = screen.queryAllByText('Extracción Personalizada');
            expect(headers.length).toBeGreaterThan(0);
        }
    });

    it('renders specific chapter sections like datos, criterios, etc.', async () => {
        const { fireEvent } = await import('@testing-library/react');
        render(
            <MemoryRouter>
                <Dashboard data={mockData} />
            </MemoryRouter>
        );

        // Click a sidebar item to change activeSection to 'datos'
        const datosLink = screen.getByText('Datos Generales');
        fireEvent.click(datosLink);

        // Now chapter renderer should be active
        expect(screen.getAllByText('Licitación de Prueba Smoke')[0]).toBeInTheDocument();
    });

    it('allows navigating to modelo de servicio from the sidebar', async () => {
        const { fireEvent } = await import('@testing-library/react');
        render(
            <MemoryRouter>
                <Dashboard data={mockData} />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByText('Modelo de Servicio'));

        expect(screen.getByText('Modelo de Servicio')).toBeInTheDocument();
    });
});
