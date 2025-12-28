import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnalyticsPage } from '../AnalyticsPage';

// Mock DB service
vi.mock('../../services/db.service', () => ({
    dbService: {
        getAllLicitaciones: vi.fn().mockResolvedValue([
            {
                hash: '123',
                data: {
                    datosGenerales: { presupuesto: 1000, moneda: 'EUR' },
                    metadata: { estado: 'PENDIENTE', tags: [] },
                    restriccionesYRiesgos: { riesgos: [] },
                    criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
                    requisitosTecnicos: { funcionales: [] },
                    requisitosSolvencia: { economica: {}, tecnica: {} },
                    modeloServicio: { sla: [] }
                },
                timestamp: Date.now()
            }
        ])
    }
}));

describe('AnalyticsPage', () => {
    it('renders analytics dashboard', async () => {
        render(<AnalyticsPage />);
        // Wait for async load
        expect(await screen.findByText(/Analytics Dashboard/i)).toBeInTheDocument();
        expect(screen.getByText('Presupuesto Total')).toBeInTheDocument();
    });
});
