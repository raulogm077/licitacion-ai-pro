import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsDashboard } from '../AnalyticsDashboard';
import { services } from '../../../config/service-registry';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    TrendingUp: () => <span data-testid="icon-trending-up" />,
    BarChart3: () => <span data-testid="icon-bar-chart" />,
    Download: () => <span data-testid="icon-download" />,
}));

// Mock export-utils
vi.mock('../../../lib/export-utils', () => ({
    exportAnalyticsToExcel: vi.fn(),
}));

// Mock sub-components
vi.mock('../components/KPICards', () => ({
    KPICards: () => <div data-testid="kpi-cards">KPI Cards</div>,
}));
vi.mock('../components/ChartsSection', () => ({
    ChartsSection: () => <div data-testid="charts-section">Charts Section</div>,
}));
vi.mock('../components/TopLists', () => ({
    TopLists: () => <div data-testid="top-lists">Top Lists</div>,
}));
vi.mock('../components/CriteriaStats', () => ({
    CriteriaStats: () => <div data-testid="criteria-stats">Criteria Stats</div>,
}));

// Mock service-registry
vi.mock('../../../config/service-registry', () => ({
    services: {
        db: {
            getAllLicitaciones: vi.fn(),
        },
    },
}));

// Mock analytics.service
vi.mock('../../../services/analytics.service', () => ({
    AnalyticsService: {
        calculateAnalytics: vi.fn(),
    },
}));

describe('AnalyticsDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders loading state initially', () => {
        // Setup mock to never resolve to keep it in loading state
        (services.db.getAllLicitaciones as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));
        render(<AnalyticsDashboard />);
        expect(screen.getByText('Cargando analytics...')).toBeInTheDocument();
    });

    it('renders empty state when no data is returned', async () => {
        (services.db.getAllLicitaciones as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, value: [] });
        const { AnalyticsService } = await import('../../../services/analytics.service');
        (AnalyticsService.calculateAnalytics as ReturnType<typeof vi.fn>).mockReturnValue({ totalLicitaciones: 0 });

        render(<AnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByText('No hay datos de analytics')).toBeInTheDocument();
            expect(screen.getByText('Analiza algunos documentos para ver métricas.')).toBeInTheDocument();
        });
    });

    it('renders dashboard components when data is present', async () => {
        (services.db.getAllLicitaciones as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, value: [{ id: 1 }] });
        const { AnalyticsService } = await import('../../../services/analytics.service');
        (AnalyticsService.calculateAnalytics as ReturnType<typeof vi.fn>).mockReturnValue({
            totalLicitaciones: 1,
            // Add other required mock data if sub-components need them,
            // though we mocked the sub-components to just render text
        });

        render(<AnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
        });

        // Verify sub-components are rendered
        expect(screen.getByTestId('kpi-cards')).toBeInTheDocument();
        expect(screen.getByTestId('charts-section')).toBeInTheDocument();
        expect(screen.getByTestId('top-lists')).toBeInTheDocument();
        expect(screen.getByTestId('criteria-stats')).toBeInTheDocument();
        expect(screen.getByText('Exportar Datos (.xlsx)')).toBeInTheDocument();
    });
});
