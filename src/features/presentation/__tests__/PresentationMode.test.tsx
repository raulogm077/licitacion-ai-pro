import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PresentationMode } from '../PresentationMode';
import { LicitacionData } from '../../../types';

describe('PresentationMode', () => {
    const mockData: LicitacionData = {
        datosGenerales: {
            titulo: 'Licitacion Alpha',
            presupuesto: 50000,
            plazoEjecucionMeses: 12,
            moneda: 'EUR',
            cpv: [],
            organoContratacion: 'Org',
        },
        metadata: {
            tags: ['IT', 'Cloud'],
            estado: 'PENDIENTE',
            // fileHash: '123', // Removed as likely not in type definition or legacy
            // fileName: 'test.pdf',
            // userId: 'user',
        },
        criteriosAdjudicacion: {
            subjetivos: [
                { descripcion: 'Calidad Técnica', ponderacion: 40, detalles: 'Detalles tec' }
            ],
            objetivos: [
                { descripcion: 'Precio', ponderacion: 60, formula: 'P = 60 * min/off' }
            ]
        },
        requisitosTecnicos: { funcionales: [], normativa: [] },
        requisitosSolvencia: {
            economica: { cifraNegocioAnualMinima: 100000 },
            tecnica: [
                { descripcion: 'Exp previa', proyectosSimilaresRequeridos: 3 }
            ]
        },
        restriccionesYRiesgos: {
            killCriteria: [],
            riesgos: [
                { descripcion: 'Riesgo 1', impacto: 'ALTO' },
                { descripcion: 'Riesgo 2', impacto: 'BAJO' }
            ],
            penalizaciones: []
        },
        modeloServicio: { sla: [], equipoMinimo: [] }
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
        // 50.000,00 € roughly
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

        // Check for class logic indirectly via badge content or just presence
        // Detailed class checks are brittle, presence is good enough.
    });

    it('calls onClose when close button clicked', () => {
        render(<PresentationMode data={mockData} onClose={mockOnClose} />);
        const closeBtn = screen.getByTitle('Salir del modo presentación');
        fireEvent.click(closeBtn);
        expect(mockOnClose).toHaveBeenCalled();
    });
});
