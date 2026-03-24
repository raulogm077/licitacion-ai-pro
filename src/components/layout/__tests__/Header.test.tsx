import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Header } from '../../layout/Header';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth.store';

// Mock the auth store
vi.mock('../../../stores/auth.store', () => ({
    useAuthStore: vi.fn(),
}));

function mockAuthState(overrides: Record<string, unknown>) {
    vi.mocked(useAuthStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
        return selector ? selector(overrides) : overrides;
    }) as typeof useAuthStore);
}

describe('Header', () => {
    const mockOnLogout = vi.fn();

    it('renders logo and navigation', () => {
        mockAuthState({ isAuthenticated: false });

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

    it('calls logout when clicked', async () => {
        const mockSignOut = vi.fn();

        mockAuthState({
            isAuthenticated: true,
            user: { email: 'test@example.com' },
            signOut: mockSignOut,
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
        await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    });
});
