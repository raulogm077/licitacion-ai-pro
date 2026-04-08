import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RiskSummary } from '../RiskSummary';
import { buildPliegoVM } from '../../../model/pliego-vm';
import { createMockLicitacionData } from '../../../../../test-utils/mock-pliego-data';

const mockData = createMockLicitacionData();
// Ensure there are some risks for testing
mockData.restriccionesYRiesgos.killCriteria = [{ criterio: 'Kill 1', cita: '...' }];
mockData.restriccionesYRiesgos.penalizaciones = [{ causa: 'Pen 1', sancion: 'Penalidad' }];
mockData.restriccionesYRiesgos.riesgos = [{ descripcion: 'Risk 1', impacto: 'ALTO' }];

describe('RiskSummary Component', () => {
    it('renders risks when present', () => {
        const vm = buildPliegoVM(mockData);
        render(<RiskSummary vm={vm} />);

        expect(screen.getByText('Mapa de Riesgos Identificados')).toBeInTheDocument();
        expect(screen.getByText('3 riesgos')).toBeInTheDocument();

        expect(screen.getByText('Kill 1')).toBeInTheDocument();
        expect(screen.getByText('Pen 1')).toBeInTheDocument();
        expect(screen.getByText('Risk 1')).toBeInTheDocument();
    });

    it('renders empty state when no risks', () => {
        const emptyData = createMockLicitacionData();
        emptyData.restriccionesYRiesgos.killCriteria = [];
        emptyData.restriccionesYRiesgos.penalizaciones = [];
        emptyData.restriccionesYRiesgos.riesgos = [];
        const vm = buildPliegoVM(emptyData);

        render(<RiskSummary vm={vm} />);

        expect(screen.getByText('No se detectaron riesgos ni penalizaciones críticas.')).toBeInTheDocument();
    });
});
