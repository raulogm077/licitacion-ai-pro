import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScoringChart } from '../ScoringChart';
import { buildPliegoVM } from '../../../model/pliego-vm';
import { createMockLicitacionData } from '../../../../../test-utils/mock-pliego-data';

const mockData = createMockLicitacionData();

describe('ScoringChart Component', () => {
    it('renders empty state when no criteria', () => {
        mockData.criteriosAdjudicacion.subjetivos = [];
        mockData.criteriosAdjudicacion.objetivos = [];
        const vm = buildPliegoVM(mockData);

        render(<ScoringChart vm={vm} />);

        expect(screen.getByText('Distribución de Criterios')).toBeInTheDocument();
        expect(screen.getByText('No hay criterios de adjudicación detectados.')).toBeInTheDocument();
    });

    it('renders criteria data correctly', () => {
        mockData.criteriosAdjudicacion.subjetivos = [
            { descripcion: 'Experiencia', ponderacion: 40, subcriterios: [] }
        ];
        mockData.criteriosAdjudicacion.objetivos = [
            { descripcion: 'Precio', ponderacion: 60 }
        ];
        const vm = buildPliegoVM(mockData);

        render(<ScoringChart vm={vm} />);

        // Assert header and legend
        expect(screen.getByText('Distribución de Criterios')).toBeInTheDocument();
        expect(screen.getByText('Automático')).toBeInTheDocument();
        expect(screen.getByText('Juicio de valor')).toBeInTheDocument();

        // Assert data
        expect(screen.getByText('Experiencia')).toBeInTheDocument();
        expect(screen.getByText('40 pts')).toBeInTheDocument();
        expect(screen.getByText('Precio')).toBeInTheDocument();
        expect(screen.getByText('60 pts')).toBeInTheDocument();

        // Assert total
        expect(screen.getByText('Total puntos detectados')).toBeInTheDocument();
        expect(screen.getByText('100 puntos')).toBeInTheDocument();
    });

    it('renders "+ n criterios más..." when > 5 criteria', () => {
        mockData.criteriosAdjudicacion.subjetivos = [
            { descripcion: 'C1', ponderacion: 10, subcriterios: [] },
            { descripcion: 'C2', ponderacion: 10, subcriterios: [] },
            { descripcion: 'C3', ponderacion: 10, subcriterios: [] },
        ];
        mockData.criteriosAdjudicacion.objetivos = [
            { descripcion: 'C4', ponderacion: 10 },
            { descripcion: 'C5', ponderacion: 10 },
            { descripcion: 'C6', ponderacion: 50 },
        ];
        const vm = buildPliegoVM(mockData);

        render(<ScoringChart vm={vm} />);

        expect(screen.getByText('+ 1 criterios más...')).toBeInTheDocument();
    });
});
