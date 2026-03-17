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

        await waitFor(() => {
            expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
        });
    });
});
