import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AlertsPanel } from '../AlertsPanel';
import { buildPliegoVM } from '../../../model/pliego-vm';
import { createMockLicitacionData } from '../../../../../test-utils/mock-pliego-data';

describe('AlertsPanel Component', () => {
    it('renders warnings from VM correctly', () => {
        const mockData = createMockLicitacionData();
        const vm = buildPliegoVM(mockData);
        // Force a critical warning manually for testing
        vm.warnings = [
            { severity: 'CRITICO', title: 'Falta Título', message: 'No se ha encontrado el título de la licitación.' }
        ];

        const onNavigate = vi.fn();
        render(<AlertsPanel vm={vm} onNavigate={onNavigate} />);

        expect(screen.getByText('Avisos del Pliego')).toBeInTheDocument();
        expect(screen.getByText('Falta Título')).toBeInTheDocument();
        expect(screen.getByText('No se ha encontrado el título de la licitación.')).toBeInTheDocument();
    });

    it('renders mock alerts when few warnings', () => {
        const mockData = createMockLicitacionData();
        const vm = buildPliegoVM(mockData);
        vm.warnings = []; // clear to force few warnings path

        // Add a mock penalizacion to trigger the other mock alert
        vm.result.restriccionesYRiesgos.penalizaciones = [{ causa: 'Penalidad X', sancion: 'Multa' }];

        const onNavigate = vi.fn();
        render(<AlertsPanel vm={vm} onNavigate={onNavigate} />);

        expect(screen.getByText('Subcontratación detectada')).toBeInTheDocument();
        expect(screen.getByText('Penalizaciones por SLA')).toBeInTheDocument();
    });

    it('calls onNavigate when alert is clicked', () => {
        const mockData = createMockLicitacionData();
        const vm = buildPliegoVM(mockData);
        vm.warnings = [
            { severity: 'CRITICO', title: 'Falta Título', message: 'No se ha encontrado el título de la licitación.' }
        ];

        const onNavigate = vi.fn();
        const { container } = render(<AlertsPanel vm={vm} onNavigate={onNavigate} />);

        const alertCard = container.querySelector('.cursor-pointer');
        expect(alertCard).toBeInTheDocument();

        fireEvent.click(alertCard!);

        expect(onNavigate).toHaveBeenCalled();
    });
});
