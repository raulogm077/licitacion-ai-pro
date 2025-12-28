import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SearchPanel } from '../SearchPanel';
import { COMMON_TAGS } from '../../../constants/tags';

// Mock dependencies
vi.mock('../../../services/db.service', () => ({
    dbService: {
        getLicitacion: vi.fn(),
        searchByPresupuestoRange: vi.fn(),
        advancedSearch: vi.fn(),
        searchByTags: vi.fn()
    }
}));

describe('SearchPanel', () => {
    const mockOnSearch = vi.fn();
    const mockOnReset = vi.fn();

    it('renders all filter inputs', () => {
        render(<SearchPanel onSearch={mockOnSearch} onReset={mockOnReset} />);

        expect(screen.getByPlaceholderText(/buscar por cliente/i)).toBeInTheDocument(); // text search

        const toggleBtn = screen.getByText('Mostrar filtros');
        expect(toggleBtn).toBeInTheDocument();

        fireEvent.click(toggleBtn);
        expect(screen.getByText('Presupuesto Mínimo')).toBeInTheDocument();
    });

    it('updates text search filter', () => {
        render(<SearchPanel onSearch={mockOnSearch} onReset={mockOnReset} />);

        const input = screen.getByPlaceholderText(/buscar por cliente/i);
        fireEvent.change(input, { target: { value: 'Limpieza' } });

        expect(input).toHaveValue('Limpieza');
    });

    it('handles number inputs for budget in advanced mode', () => {
        render(<SearchPanel onSearch={mockOnSearch} onReset={mockOnReset} />);

        fireEvent.click(screen.getByText('Mostrar filtros'));

        const minInput = screen.getByPlaceholderText('0');
        fireEvent.change(minInput, { target: { value: '1000' } });

        expect(minInput).toHaveValue(1000);
    });

    it('selects tags correctly', () => {
        render(<SearchPanel onSearch={mockOnSearch} onReset={mockOnReset} />);
        fireEvent.click(screen.getByText('Mostrar filtros'));

        const tag = COMMON_TAGS[0];
        const tagAddBtn = screen.getByText(`+ ${tag}`);

        fireEvent.click(tagAddBtn);

        expect(screen.getByText(tag, { selector: 'span' })).toBeInTheDocument(); // Tag becomes a badge
    });

    it('clears filters when clear button clicked', () => {
        render(<SearchPanel onSearch={mockOnSearch} onReset={mockOnReset} />);

        const input = screen.getByPlaceholderText(/buscar por cliente/i);
        fireEvent.change(input, { target: { value: 'Test' } });

        const clearBtn = screen.getByText('Limpiar');
        fireEvent.click(clearBtn);

        expect(input).toHaveValue('');
        expect(mockOnReset).toHaveBeenCalled();
    });
});
