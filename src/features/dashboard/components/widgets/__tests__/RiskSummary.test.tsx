import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RiskSummary } from '../RiskSummary';
import { PliegoVM } from '../../../model/pliego-vm';

describe('RiskSummary', () => {
    it('renders empty state when no risks are present', () => {
        const emptyVM = {
            result: {
                restriccionesYRiesgos: {
                    killCriteria: [],
                    penalizaciones: [],
                    riesgos: []
                }
            },
            counts: { riesgos: 0 }
        } as unknown as PliegoVM;

        render(<RiskSummary vm={emptyVM} />);
        expect(screen.getByText('No se detectaron riesgos ni penalizaciones críticas.')).toBeInTheDocument();
    });

    it('renders risks mapped correctly by severity', () => {
        const vm = {
            result: {
                restriccionesYRiesgos: {
                    killCriteria: [{ criterio: 'Falta de solvencia' }],
                    penalizaciones: [{ causa: 'Retraso en entrega' }],
                    riesgos: [{ descripcion: 'Presupuesto ajustado' }]
                }
            },
            counts: { riesgos: 3 }
        } as unknown as PliegoVM;

        render(<RiskSummary vm={vm} />);

        expect(screen.getByText('Falta de solvencia')).toBeInTheDocument();
        expect(screen.getByText('Retraso en entrega')).toBeInTheDocument();
        expect(screen.getByText('Presupuesto ajustado')).toBeInTheDocument();

        expect(screen.getByText('Alto')).toBeInTheDocument();
        expect(screen.getByText('Medio')).toBeInTheDocument();
        expect(screen.getByText('Bajo')).toBeInTheDocument();
    });
});
