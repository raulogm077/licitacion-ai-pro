import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PriceSimulator } from '../PriceSimulator';
import { PliegoVM } from '../../../model/pliego-vm';

function buildVM(overrides: {
    objetivos?: Array<{ descripcion: string; ponderacion: number; formula?: string | null }>;
    umbralAnormalidad?: string;
    presupuesto?: number;
}): PliegoVM {
    return {
        result: {
            datosGenerales: {
                presupuesto: overrides.presupuesto ?? 200_000,
                moneda: 'EUR',
            },
            criteriosAdjudicacion: {
                objetivos: overrides.objetivos ?? [],
                subjetivos: [],
                umbralAnormalidad: overrides.umbralAnormalidad ?? '',
            },
        },
    } as unknown as PliegoVM;
}

describe('PriceSimulator', () => {
    /**
     * La propiedad que más importa del componente: cuando no entiende la
     * fórmula no enseña ningún número. Un cálculo sobre una fórmula mal
     * interpretada sería peor que no ofrecer la función.
     */
    it('no simula cuando la fórmula no es interpretable y explica por qué', () => {
        const vm = buildVM({
            objetivos: [{ descripcion: 'Mejoras', ponderacion: 20, formula: 'Asignación lineal por compromisos' }],
        });

        render(<PriceSimulator vm={vm} />);

        expect(screen.getByText(/no coincide con ningún patrón conocido/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/tu oferta/i)).not.toBeInTheDocument();
    });

    it('avisa cuando el pliego no trae criterios objetivos', () => {
        render(<PriceSimulator vm={buildVM({ objetivos: [] })} />);
        expect(screen.getByText(/no recoge criterios objetivos/i)).toBeInTheDocument();
    });

    it('calcula los puntos de cada escenario de competencia', () => {
        const vm = buildVM({
            objetivos: [{ descripcion: 'Precio', ponderacion: 40, formula: '40 x (oferta mínima / oferta analizada)' }],
        });

        render(<PriceSimulator vm={vm} />);
        fireEvent.change(screen.getByLabelText(/tu oferta/i), { target: { value: '100000' } });

        // Nadie baja: 40 pts. Alguien baja un 10 %: 40 × 0,9 = 36 pts.
        expect(screen.getByText('40 pts')).toBeInTheDocument();
        expect(screen.getByText('36 pts')).toBeInTheDocument();
        expect(screen.getByText('34 pts')).toBeInTheDocument();
    });

    it('avisa de riesgo de baja temeraria cuando el umbral va contra el presupuesto', () => {
        const vm = buildVM({
            objetivos: [{ descripcion: 'Precio', ponderacion: 40, formula: '40 x (oferta mínima / oferta analizada)' }],
            umbralAnormalidad: 'Ofertas un 25% por debajo del presupuesto base de licitación',
            presupuesto: 200_000,
        });

        render(<PriceSimulator vm={vm} />);
        // El suelo está en 150.000; 140.000 queda por debajo.
        fireEvent.change(screen.getByLabelText(/tu oferta/i), { target: { value: '140000' } });

        expect(screen.getByRole('alert')).toHaveTextContent(/baja temeraria/i);
    });

    it('no avisa de temeraria cuando la oferta está por encima del suelo', () => {
        const vm = buildVM({
            objetivos: [{ descripcion: 'Precio', ponderacion: 40, formula: '40 x (oferta mínima / oferta analizada)' }],
            umbralAnormalidad: 'Ofertas un 25% por debajo del presupuesto base de licitación',
            presupuesto: 200_000,
        });

        render(<PriceSimulator vm={vm} />);
        fireEvent.change(screen.getByLabelText(/tu oferta/i), { target: { value: '180000' } });

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    /**
     * El umbral contra la media no se puede anticipar: la media no existe hasta
     * la apertura de plicas. El componente debe decirlo, no callarlo.
     */
    it('explica que el umbral sobre la media no se puede anticipar', () => {
        const vm = buildVM({
            objetivos: [{ descripcion: 'Precio', ponderacion: 40, formula: '40 x (oferta mínima / oferta analizada)' }],
            umbralAnormalidad: 'Se considerará temeraria la oferta un 10% inferior a la media.',
        });

        render(<PriceSimulator vm={vm} />);
        expect(screen.getByText(/no se conoce hasta la apertura de plicas/i)).toBeInTheDocument();
    });
});
