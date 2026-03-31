import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnalyticsPage } from '../AnalyticsPage';

// Mock DB service
vi.mock('../../config/service-registry', () => ({
    services: {
        db: {
            getAllLicitaciones: vi.fn().mockResolvedValue({
                ok: true,
                value: [
                    {
                        hash: '123',
                        fileName: 'test.pdf',
                        timestamp: Date.now(),
                        data: {
                            datosGenerales: {
                                presupuesto: 1000,
                                moneda: 'EUR',
                                cpv: [],
                                organoContratacion: '',
                                titulo: 'Test',
                                plazoEjecucionMeses: 12,
                            },
                            metadata: { estado: 'PENDIENTE', tags: [] },
                            restriccionesYRiesgos: { riesgos: [], killCriteria: [], penalizaciones: [] },
                            criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
                            requisitosTecnicos: { funcionales: [], normativa: [] },
                            requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [] },
                            modeloServicio: { sla: [], equipoMinimo: [] },
                        },
                        metadata: { estado: 'PENDIENTE', tags: [] },
                    },
                ],
            }),
        },
    },
}));

// Mock recharts to prevent ResizeObserver errors in JSDOM
vi.mock('recharts', async () => {
    const ActualRecharts = await vi.importActual('recharts');
    return {
        ...ActualRecharts,
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
            <div style={{ width: 800, height: 400 }}>{children}</div>
        ),
    };
});

describe('AnalyticsPage', () => {
    it('renders analytics dashboard', async () => {
        render(<AnalyticsPage />);

        // Wait for the dashboard content to render.
        // The Suspense fallback (animate-spin) and the AnalyticsDashboard internal
        // loading state ("Cargando analytics...") both resolve asynchronously.
        // In Vitest, React lazy() may resolve synchronously so we don't assert the
        // intermediate spinner state — we go straight to the final rendered state.
        await waitFor(
            () => {
                expect(screen.getByText(/Analytics Dashboard|No hay datos de analytics/i)).toBeInTheDocument();
            },
            { timeout: 10000 }
        );
    });
});
