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
                            datosGenerales: { presupuesto: 1000, moneda: 'EUR', cpv: [], organoContratacion: '', titulo: 'Test', plazoEjecucionMeses: 12 },
                            metadata: { estado: 'PENDIENTE', tags: [] },
                            restriccionesYRiesgos: { riesgos: [], killCriteria: [], penalizaciones: [] },
                            criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
                            requisitosTecnicos: { funcionales: [], normativa: [] },
                            requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [] },
                            modeloServicio: { sla: [], equipoMinimo: [] }
                        },
                        metadata: { estado: 'PENDIENTE', tags: [] }
                    }
                ]
            })
        }
    }
}));

describe('AnalyticsPage', () => {
    it('renders analytics dashboard', async () => {
        render(<AnalyticsPage />);
        // Wait for async load using wait for instead of findByText directly on lazy load which may fail
        await waitFor(() => {
            expect(screen.getByText('Cargando analytics...')).toBeInTheDocument();
        });

        // Let the effect finish and actual data render
        await waitFor(() => {
            expect(screen.queryByText('Cargando analytics...')).not.toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
        });
    });
});
