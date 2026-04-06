import { render, screen } from '@testing-library/react';
import { RiskSummary } from '../RiskSummary';
import { PliegoVM } from '../../../model/pliego-vm';

describe('RiskSummary', () => {
    it('renders empty state correctly', () => {
        const mockVM = {
            result: {
                restriccionesYRiesgos: {
                    killCriteria: [],
                    penalizaciones: [],
                    riesgos: [],
                },
            },
            counts: {
                riesgos: 0,
            },
        } as unknown as PliegoVM;

        render(<RiskSummary vm={mockVM} />);

        expect(screen.getByText('Mapa de Riesgos Identificados')).toBeInTheDocument();
        expect(screen.getByText('0 riesgos')).toBeInTheDocument();
        expect(screen.getByText('No se detectaron riesgos ni penalizaciones críticas.')).toBeInTheDocument();
    });

    it('renders risks mapped correctly', () => {
        const mockVM = {
            result: {
                restriccionesYRiesgos: {
                    killCriteria: [
                        { criterio: 'High Risk 1', tipo: 'kill_criteria' }
                    ],
                    penalizaciones: [
                        { causa: 'Medium Risk 1', penalizacion: 'x' }
                    ],
                    riesgos: [
                        { descripcion: 'Low Risk 1', severidad: 'Baja' }
                    ],
                },
            },
            counts: {
                riesgos: 3,
            },
        } as unknown as PliegoVM;

        render(<RiskSummary vm={mockVM} />);

        expect(screen.getByText('3 riesgos')).toBeInTheDocument();

        // High Risk
        expect(screen.getByText('High Risk 1')).toBeInTheDocument();
        expect(screen.getByText('Alto')).toBeInTheDocument();

        // Medium Risk
        expect(screen.getByText('Medium Risk 1')).toBeInTheDocument();
        expect(screen.getByText('Medio')).toBeInTheDocument();

        // Low Risk
        expect(screen.getByText('Low Risk 1')).toBeInTheDocument();
        expect(screen.getByText('Bajo')).toBeInTheDocument();
    });
});
