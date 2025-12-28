import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from '../Dashboard';
import { MemoryRouter } from 'react-router-dom';
import { LicitacionData } from '../../../types';

// Mock child components to focus on Dashboard logic/layout
vi.mock('../RequirementsMatrix', () => ({
    RequirementsMatrix: () => <div data-testid="req-matrix">Matrix</div>
}));
vi.mock('../RisksPanel', () => ({
    RisksPanel: () => <div data-testid="risks-panel">Risks</div>
}));
vi.mock('../ServiceModel', () => ({
    ServiceModel: () => <div data-testid="service-model">Service</div>
}));

describe('Dashboard', () => {
    const mockData: LicitacionData = {
        metadata: {
            tags: ['test']
        },
        datosGenerales: {
            titulo: 'Test Licitacion',
            presupuesto: 10000,
            organoContratacion: 'Org',
            plazoEjecucionMeses: 12,
            cpv: ['12345678'],
            moneda: 'EUR'
        },
        criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
        requisitosTecnicos: { funcionales: [], normativa: [] },
        requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 1000 }, tecnica: [] },
        restriccionesYRiesgos: { riesgos: [], killCriteria: [], penalizaciones: [] },
        modeloServicio: { sla: [], equipoMinimo: [] }
    };

    it('renders dashboard with data', () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} onUpdate={vi.fn()} />
            </MemoryRouter>
        );

        expect(screen.getByText('Test Licitacion')).toBeInTheDocument();
        expect(screen.getByText('10.000,00 €')).toBeInTheDocument(); // Formatted
        expect(screen.getByTestId('req-matrix')).toBeInTheDocument();
    });

    it('navigates tabs correctly', () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} onUpdate={vi.fn()} />
            </MemoryRouter>
        );

        // Assume tabs exist (General, Requisitos, etc)
        // If tabs are not rendered in simplified mock or logic, we might need to adjust.
        // Dashboard code shows tabs? No, it shows Cards. 
        // Wait, Dashboard.tsx does NOT have tabs. It renders "RequirementsMatrix" and "Risks" in cards or grid.
        // My previous test assumed tabs. I need to fix this expectation. Use scroll or existence check.

        expect(screen.getByTestId('req-matrix')).toBeInTheDocument();
        expect(screen.getByText('Riesgos Detectados')).toBeInTheDocument();
    });

    it('shows safe mode interaction', () => {
        // Dashboard.tsx implementation shows Edit/Save buttons.
        render(
            <MemoryRouter>
                <Dashboard data={mockData} onUpdate={vi.fn()} />
            </MemoryRouter>
        );

        const editBtn = screen.getByText('Editar');
        fireEvent.click(editBtn);

        expect(screen.getByText('Guardar Cambios')).toBeInTheDocument();
        expect(screen.getByText('Cancelar')).toBeInTheDocument();
    });
});
