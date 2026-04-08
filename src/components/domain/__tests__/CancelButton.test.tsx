import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CancelButton } from '../CancelButton';

describe('CancelButton Component', () => {
    it('renders and responds to click', () => {
        const onClick = vi.fn();
        render(<CancelButton onClick={onClick} />);

        const btn = screen.getByRole('button', { name: /Cancelar Análisis/i });
        expect(btn).toBeInTheDocument();

        fireEvent.click(btn);
        expect(onClick).toHaveBeenCalled();
    });

    it('shows loading state', () => {
        render(<CancelButton onClick={vi.fn()} loading={true} />);
        const btn = screen.getByRole('button', { name: /Cancelar/i });
        expect(btn).toBeDisabled();
        expect(screen.getByText('Cancelando...')).toBeInTheDocument();
    });
});
