import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SearchPanel } from '../SearchPanel'; // Using same component but focusing on filter logic via UI

vi.mock('../../../services/db.service');

describe('SearchFilters', () => {
    // Tests specifically focusing on edge cases of filtering
    const mockOnSearch = vi.fn();
    const mockOnReset = vi.fn();

    it('toggles advanced filters on button click', () => {
        render(<SearchPanel onSearch={mockOnSearch} onReset={mockOnReset} />);

        expect(screen.queryByText('Presupuesto Máximo')).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('Mostrar filtros'));
        expect(screen.getByText('Presupuesto Máximo')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Ocultar filtros'));
        expect(screen.queryByText('Presupuesto Máximo')).not.toBeInTheDocument();
    });

    it('allows entering min and max budget', () => {
        render(<SearchPanel onSearch={mockOnSearch} onReset={mockOnReset} />);
        fireEvent.click(screen.getByText('Mostrar filtros'));

        const min = screen.getByPlaceholderText('0');
        const max = screen.getByPlaceholderText('1000000');

        fireEvent.change(min, { target: { value: '100' } });
        fireEvent.change(max, { target: { value: '200' } });

        expect(min).toHaveValue(100);
        expect(max).toHaveValue(200);

        // Check if onSearch called with correct filters logic would be ideal if controlled, 
        // but component likely handles state internally until search logic triggers.
        // We verify interactions work.
    });

    it('resets budget inputs on clear', () => {
        render(<SearchPanel onSearch={mockOnSearch} onReset={mockOnReset} />);
        fireEvent.click(screen.getByText('Mostrar filtros'));

        const min = screen.getByPlaceholderText('0');
        fireEvent.change(min, { target: { value: '100' } });

        fireEvent.click(screen.getByText('Limpiar'));

        expect(min).toHaveValue(null);
    });
});
