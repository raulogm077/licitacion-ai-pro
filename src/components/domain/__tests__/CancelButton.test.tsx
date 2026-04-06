import { render, screen, fireEvent } from '@testing-library/react';
import { CancelButton } from '../CancelButton';
import { vi } from 'vitest';

describe('CancelButton', () => {
    it('renders with default state and handles click', () => {
        const handleClick = vi.fn();
        render(<CancelButton onClick={handleClick} />);

        const button = screen.getByRole('button', { name: /cancelar análisis/i });
        expect(button).toBeInTheDocument();
        expect(button).not.toBeDisabled();
        expect(screen.getByText('Cancelar Análisis')).toBeInTheDocument();

        fireEvent.click(button);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders loading state and is disabled', () => {
        const handleClick = vi.fn();
        render(<CancelButton onClick={handleClick} loading={true} />);

        const button = screen.getByRole('button', { name: /cancelar análisis/i });
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
        expect(screen.getByText('Cancelando...')).toBeInTheDocument();

        fireEvent.click(button);
        expect(handleClick).not.toHaveBeenCalled();
    });
});
