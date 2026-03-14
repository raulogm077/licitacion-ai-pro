import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Header } from '../../layout/Header';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth.store';

// Mock the auth store
vi.mock('../../../stores/auth.store', () => ({
    useAuthStore: vi.fn(),
}));

describe('Header', () => {
    const mockOnLogout = vi.fn();

    it('renders logo and navigation', () => {
        // Mock unauthenticated state
        vi.mocked(useAuthStore).mockImplementation((selector) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const state = { isAuthenticated: false } as any;
            return selector ? selector(state) : state;
        });

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
        const mockSignOut = vi.fn();

        // Mock authenticated state with signOut function
        vi.mocked(useAuthStore).mockImplementation((selector) => {
            const state = {
                isAuthenticated: true,
                user: { email: 'test@example.com' },
                signOut: mockSignOut,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any;
            return selector ? selector(state) : state;
        });

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

        // 1. Open User Menu
        const userMenuBtn = screen.getByText('test@example.com');
        fireEvent.click(userMenuBtn);

        // 2. Click Logout
        const logoutBtn = screen.getByText(/Cerrar sesión/i);
        fireEvent.click(logoutBtn);

        // 3. Expect store signOut to be called
        expect(mockSignOut).toHaveBeenCalled();
    });
});
