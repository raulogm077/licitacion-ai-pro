import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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

    it('renders title and tags', () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        expect(screen.getByText('Licitacion Alpha')).toBeInTheDocument();
        expect(screen.getByText('IT')).toBeInTheDocument();
        expect(screen.getByText('Cloud')).toBeInTheDocument();
    });

    it('renders budget formatted', () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        expect(screen.getByText(/50\.000/)).toBeInTheDocument();
        expect(screen.getByText(/Meses/i)).toBeInTheDocument();
    });

    it('renders criteria groups', () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        expect(screen.getByText('Criterios Subjetivos')).toBeInTheDocument();
        expect(screen.getByText('Calidad Técnica')).toBeInTheDocument();
        expect(screen.getByText('40%')).toBeInTheDocument();

        expect(screen.getByText('Criterios Objetivos')).toBeInTheDocument();
        expect(screen.getByText('Precio')).toBeInTheDocument();
        expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('renders solvency requirements', () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        expect(screen.getByText('Solvencia Económica')).toBeInTheDocument();
        expect(screen.getByText(/100\.000/)).toBeInTheDocument();

        expect(screen.getByText('Solvencia Técnica')).toBeInTheDocument();
        expect(screen.getByText('3 proyectos similares requeridos')).toBeInTheDocument();
    });

    it('renders risks with correct visual indicators', () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        expect(screen.getByText('Riesgos Identificados')).toBeInTheDocument();
        expect(screen.getByText('Riesgo 1')).toBeInTheDocument();
        expect(screen.getByText('ALTO')).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        const closeBtn = screen.getByTitle('Salir del modo presentación');
        fireEvent.click(closeBtn);
        expect(mockOnClose).toHaveBeenCalled();
    });
});
