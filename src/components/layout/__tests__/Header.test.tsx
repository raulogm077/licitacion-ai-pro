import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Header } from '../../layout/Header';
import { MemoryRouter } from 'react-router-dom';

describe('Header', () => {
    const mockOnLogout = vi.fn();

    it('renders logo and navigation', () => {
        render(
            <MemoryRouter>
                <Header
                    onLogout={mockOnLogout}
                    status="IDLE"
                    data={null}
                    reset={vi.fn()}
                    darkMode={false}
                    setDarkMode={vi.fn()}
                />
            </MemoryRouter>
        );

        expect(screen.getByText(/Analista de Pliegos/i)).toBeInTheDocument();
        expect(screen.getByText(/Historial/i)).toBeInTheDocument();
    });

    it('calls logout when clicked', () => {
        render(
            <MemoryRouter>
                <Header
                    onLogout={mockOnLogout}
                    status="IDLE"
                    data={null}
                    reset={vi.fn()}
                    darkMode={false}
                    setDarkMode={vi.fn()}
                />
            </MemoryRouter>
        );

        const logoutBtn = screen.getByTitle(/Cerrar sesión/i);
        fireEvent.click(logoutBtn);

        expect(mockOnLogout).toHaveBeenCalled();
    });
});
