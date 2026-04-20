import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AlertsPanel } from '../AlertsPanel';
import { PliegoVM } from '../../../model/pliego-vm';

describe('AlertsPanel', () => {
    it('renders alerts and calls onNavigate when clicked', () => {
        const vm = {
            warnings: [
                { severity: 'CRITICO', title: 'Critical Warning', message: 'This is critical' },
                { severity: 'NORMAL', title: 'Normal Warning', message: 'This is a warning' },
            ],
        } as unknown as PliegoVM;

        const mockNavigate = vi.fn();
        render(<AlertsPanel vm={vm} onNavigate={mockNavigate} />);

        expect(screen.getByText('Critical Warning')).toBeInTheDocument();
        expect(screen.getByText('Normal Warning')).toBeInTheDocument();
        expect(screen.queryByText('Subcontratación detectada')).not.toBeInTheDocument();

        const alertItem = screen.getByText('Critical Warning');
        fireEvent.click(alertItem);
        expect(mockNavigate).toHaveBeenCalledWith('resumen');
    });

    it('renders an honest empty state when there are no warnings', () => {
        const vm = {
            warnings: [],
        } as unknown as PliegoVM;

        render(<AlertsPanel vm={vm} onNavigate={vi.fn()} />);

        expect(screen.getByText(/No hay alertas adicionales/i)).toBeInTheDocument();
    });

    it('routes solvency-related warnings to the solvencia section', () => {
        const vm = {
            warnings: [{ severity: 'NORMAL', title: 'Aviso', message: 'No se han encontrado requisitos de solvencia.' }],
        } as unknown as PliegoVM;

        const mockNavigate = vi.fn();
        render(<AlertsPanel vm={vm} onNavigate={mockNavigate} />);

        fireEvent.click(screen.getByText('No se han encontrado requisitos de solvencia.'));
        expect(mockNavigate).toHaveBeenCalledWith('solvencia');
    });
});
