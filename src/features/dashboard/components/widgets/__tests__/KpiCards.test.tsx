import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { KpiCards } from '../KpiCards';
import { PliegoVM } from '../../../model/pliego-vm';

vi.mock('../../detail/FeedbackToggle', () => ({
    FeedbackToggle: ({ fieldPath, value }: { fieldPath: string; value: string }) => (
        <div data-testid={`feedback-toggle-${fieldPath}`}>{value}</div>
    ),
}));

// We also mock lucide-react icons since tests might fail when rendering them if not handled
vi.mock('lucide-react', () => ({
    Euro: () => <span data-testid="icon-euro" />,
    CalendarClock: () => <span data-testid="icon-calendar" />,
    Timer: () => <span data-testid="icon-timer" />,
    TrendingUp: () => <span data-testid="icon-trending" />,
}));

describe('KpiCards Component', () => {
    const mockVM = {
        display: {
            presupuesto: '10.000,00 €',
            plazo: '12 meses',
            moneda: 'EUR',
        },
        result: {
            datosGenerales: {
                fechaLimitePresentacion: '2024-12-31',
                presupuesto: 10000,
            },
        },
    } as unknown as PliegoVM;

    it('renders all KPI cards with correct labels and display values', () => {
        render(<KpiCards vm={mockVM} />);

        expect(screen.getByText('Presupuesto Base de Licitación')).toBeInTheDocument();
        expect(screen.getAllByText('10.000,00 €')[0]).toBeInTheDocument();

        expect(screen.getByText('Fecha Límite de Presentación')).toBeInTheDocument();
        expect(screen.getAllByText('2024-12-31')[0]).toBeInTheDocument();

        expect(screen.getByText('Duración del Contrato')).toBeInTheDocument();
        expect(screen.getAllByText('12 meses')[0]).toBeInTheDocument();

        expect(screen.getByText('Valor Estimado Total')).toBeInTheDocument();

        // 10000 * 1.5 = 15000 -> "15.000,00 €" using the Spanish locale which includes a non-breaking space
        const expectedValue = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(15000);
        const elements = screen.getAllByText(new RegExp(expectedValue.replace(/\u00a0/g, ' ')));
        expect(elements[0]).toBeInTheDocument();
    });

    it('renders FeedbackToggle components with the correct field paths', () => {
        render(<KpiCards vm={mockVM} />);

        expect(screen.getByTestId('feedback-toggle-datosGenerales.presupuesto')).toBeInTheDocument();
        expect(screen.getByTestId('feedback-toggle-datosGenerales.fechaLimitePresentacion')).toBeInTheDocument();
        expect(screen.getByTestId('feedback-toggle-datosGenerales.duracionContrato')).toBeInTheDocument();
        expect(screen.getByTestId('feedback-toggle-datosGenerales.valorEstimado')).toBeInTheDocument();
    });

    it('renders default date limit properly when missing', () => {
        const mockVMNoDate = {
            display: { presupuesto: '10.000,00 €', plazo: '12 meses', moneda: 'EUR' },
            result: { datosGenerales: { fechaLimitePresentacion: null, presupuesto: 10000 } },
        } as unknown as PliegoVM;
        render(<KpiCards vm={mockVMNoDate} />);
        expect(screen.getAllByText('No especificada')[0]).toBeInTheDocument();
    });
});
