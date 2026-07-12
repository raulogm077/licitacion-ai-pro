import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PresentationMode } from '../PresentationMode';
import { LicitacionData } from '../../../types';
import { tf } from '../../../test-utils/tracked-field-factory';

describe('PresentationMode', () => {
    const mockData: LicitacionData = {
        datosGenerales: {
            titulo: tf('Licitacion Alpha'),
            presupuesto: tf(50000),
            plazoEjecucionMeses: tf(12),
            moneda: tf('EUR'),
            cpv: tf([]),
            organoContratacion: tf('Org'),
        },
        metadata: {
            tags: ['IT', 'Cloud'],
            estado: 'PENDIENTE',
        },
        criteriosAdjudicacion: {
            subjetivos: [
                { descripcion: 'Calidad Técnica', ponderacion: 40, detalles: 'Detalles tec', subcriterios: [] },
            ],
            objetivos: [{ descripcion: 'Precio', ponderacion: 60, formula: 'P = 60 * min/off' }],
        },
        requisitosTecnicos: { funcionales: [], normativa: [] },
        requisitosSolvencia: {
            economica: { cifraNegocioAnualMinima: 100000 },
            tecnica: [{ descripcion: 'Exp previa', proyectosSimilaresRequeridos: 3 }],
            profesional: [],
        },
        restriccionesYRiesgos: {
            killCriteria: [],
            riesgos: [
                { descripcion: 'Riesgo 1', impacto: 'ALTO' },
                { descripcion: 'Riesgo 2', impacto: 'BAJO' },
            ],
            penalizaciones: [],
        },
        modeloServicio: { sla: [], equipoMinimo: [] },
    };

    const mockOnClose = vi.fn();

    beforeEach(() => {
        mockOnClose.mockClear();
    });

    // Slide deck order: Portada → Cifras clave → Criterios → Solvencia → Riesgos
    const goToSlide = async (title: string) => {
        fireEvent.click(screen.getByRole('button', { name: `Ir a ${title}` }));
        return screen.findByRole('region', { name: title });
    };

    it('renders the cover slide with title and tags', () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        expect(screen.getByText('Licitacion Alpha')).toBeInTheDocument();
        expect(screen.getByText('IT')).toBeInTheDocument();
        expect(screen.getByText('Cloud')).toBeInTheDocument();
    });

    it('shows slide counter and progress dots for all slides', () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        expect(screen.getByText('1 / 5')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ir a Portada' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ir a Riesgos' })).toBeInTheDocument();
    });

    it('renders budget and duration on the key figures slide', async () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        await goToSlide('Cifras clave');
        expect(await screen.findByText(/50\.000/)).toBeInTheDocument();
        expect(screen.getByText(/meses/i)).toBeInTheDocument();
    });

    it('renders criteria groups on the criteria slide', async () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        await goToSlide('Criterios');
        expect(await screen.findByText('Calidad Técnica')).toBeInTheDocument();
        expect(screen.getByText('40%')).toBeInTheDocument();
        expect(screen.getByText('Precio')).toBeInTheDocument();
        expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('renders solvency requirements on the solvency slide', async () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        await goToSlide('Solvencia');
        expect(await screen.findByText('Solvencia Económica')).toBeInTheDocument();
        expect(screen.getByText(/100\.000/)).toBeInTheDocument();
        expect(screen.getByText('Solvencia Técnica')).toBeInTheDocument();
        expect(screen.getByText('3 proyectos similares requeridos')).toBeInTheDocument();
    });

    it('renders risks with severity badges on the risks slide', async () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        await goToSlide('Riesgos');
        expect(await screen.findByText('Riesgo 1')).toBeInTheDocument();
        expect(screen.getByText('ALTO')).toBeInTheDocument();
    });

    it('navigates with the arrow controls', async () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        fireEvent.click(screen.getByRole('button', { name: 'Diapositiva siguiente' }));
        expect(await screen.findByText('2 / 5')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Diapositiva anterior' }));
        expect(await screen.findByText('1 / 5')).toBeInTheDocument();
    });

    it('navigates with the keyboard', async () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(await screen.findByText('2 / 5')).toBeInTheDocument();
        fireEvent.keyDown(window, { key: 'ArrowLeft' });
        expect(await screen.findByText('1 / 5')).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        const closeBtn = screen.getByTitle('Salir del modo presentación');
        fireEvent.click(closeBtn);
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose on Escape', () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(mockOnClose).toHaveBeenCalled();
    });
});
