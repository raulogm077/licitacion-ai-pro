import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScoringChart } from '../ScoringChart';
import { PliegoVM } from '../../../model/pliego-vm';

describe('ScoringChart', () => {
    it('renders empty state if no criteria exist', () => {
        const vm = {
            result: {
                criteriosAdjudicacion: {
                    objetivos: [],
                    subjetivos: [],
                },
            },
        } as unknown as PliegoVM;

        render(<ScoringChart vm={vm} />);
        expect(screen.getByText('No hay criterios de adjudicación detectados.')).toBeInTheDocument();
    });

    it('renders criteria data accurately', () => {
        const vm = {
            result: {
                criteriosAdjudicacion: {
                    objetivos: [{ descripcion: 'Precio', ponderacion: 60 }],
                    subjetivos: [{ descripcion: 'Calidad', ponderacion: 40 }],
                },
            },
        } as unknown as PliegoVM;

        render(<ScoringChart vm={vm} />);

        // Assert criteria labels
        expect(screen.getByText('Precio')).toBeInTheDocument();
        expect(screen.getByText('Calidad')).toBeInTheDocument();

        // Assert total
        expect(screen.getByText('100 puntos')).toBeInTheDocument();

        // Ensure points render
        expect(screen.getAllByText('60 pts')[0]).toBeInTheDocument();
        expect(screen.getAllByText('40 pts')[0]).toBeInTheDocument();
    });
});
