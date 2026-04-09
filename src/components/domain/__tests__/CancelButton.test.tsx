import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CancelButton } from '../CancelButton';

describe('CancelButton', () => {
    it('renders and calls onClick when not loading', () => {
        const onClick = vi.fn();
        render(<CancelButton onClick={onClick} loading={false} />);

        const button = screen.getByRole('button', { name: /Cancelar análisis/i });
        expect(button).toBeInTheDocument();
        expect(button).not.toBeDisabled();
        expect(button).toHaveTextContent(/Cancelar Análisis/i);

        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('renders loading state and is disabled', () => {
        const onClick = vi.fn();
        render(<CancelButton onClick={onClick} loading={true} />);

        const button = screen.getByRole('button', { name: /Cancelar análisis/i });
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
        expect(button).toHaveTextContent(/Cancelando/i);

        fireEvent.click(button);
        expect(onClick).not.toHaveBeenCalled();
    });
});
