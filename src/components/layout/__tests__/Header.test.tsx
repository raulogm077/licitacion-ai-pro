import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Header } from '../Header';
import { BrowserRouter } from 'react-router-dom';

const { mockNavigate, mockUseAuthStore } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockUseAuthStore: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<any>('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useLocation: () => ({ pathname: '/' })
    };
});

vi.mock('../../../stores/auth.store', () => ({
    useAuthStore: (selector: any) => selector({ isAuthenticated: mockUseAuthStore() })
}));

vi.mock('../../ui/UserMenu', () => ({
    UserMenu: () => <button data-testid="mock-user-menu">User Menu</button>
}));

describe('Header Component', () => {
    it('renders logo and navigation items', () => {
        mockUseAuthStore.mockReturnValue(false);
        render(
            <BrowserRouter>
                <Header
                    status="IDLE"
                    data={null}
                    reset={vi.fn()}
                    darkMode={false}
                    setDarkMode={vi.fn()}
                    onLogout={vi.fn()}
                />
            </BrowserRouter>
        );
        expect(screen.getByText('Analista de Pliegos')).toBeInTheDocument();
        expect(screen.getByText('Historial')).toBeInTheDocument();
        expect(screen.getByText('Plantillas')).toBeInTheDocument();
    });

    it('handles navigation clicks', () => {
        mockUseAuthStore.mockReturnValue(false);
        render(
            <BrowserRouter>
                <Header
                    status="IDLE"
                    data={null}
                    reset={vi.fn()}
                    darkMode={false}
                    setDarkMode={vi.fn()}
                    onLogout={vi.fn()}
                />
            </BrowserRouter>
        );
        fireEvent.click(screen.getByRole('button', { name: /Historial/i }));
        expect(mockNavigate).toHaveBeenCalledWith('/history');
    });

    it('shows presentation button when status is COMPLETED and data exists', () => {
        mockUseAuthStore.mockReturnValue(false);
        render(
            <BrowserRouter>
                <Header
                    status="COMPLETED"
                    data={{ hash: '123' } as unknown as import('../../../types').LicitacionData}
                    reset={vi.fn()}
                    darkMode={false}
                    setDarkMode={vi.fn()}
                    onLogout={vi.fn()}
                />
            </BrowserRouter>
        );
        expect(screen.getByText('Presentar')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Presentar/i }));
        expect(mockNavigate).toHaveBeenCalledWith('/presentation');
    });

    it('toggles dark mode', () => {
        mockUseAuthStore.mockReturnValue(false);
        const setDarkMode = vi.fn();
        render(
            <BrowserRouter>
                <Header
                    status="IDLE"
                    data={null}
                    reset={vi.fn()}
                    darkMode={false}
                    setDarkMode={setDarkMode}
                    onLogout={vi.fn()}
                />
            </BrowserRouter>
        );
        fireEvent.click(screen.getByTitle('Cambiar a modo oscuro'));
        expect(setDarkMode).toHaveBeenCalledWith(true);
    });

    it('renders UserMenu when authenticated', () => {
        mockUseAuthStore.mockReturnValue(true);
        render(
            <BrowserRouter>
                <Header
                    status="IDLE"
                    data={null}
                    reset={vi.fn()}
                    darkMode={false}
                    setDarkMode={vi.fn()}
                    onLogout={vi.fn()}
                />
            </BrowserRouter>
        );
        expect(screen.getByTestId('mock-user-menu')).toBeInTheDocument();
    });

    it('handles login click when not authenticated', () => {
        mockUseAuthStore.mockReturnValue(false);
        const onLogout = vi.fn();
        render(
            <BrowserRouter>
                <Header
                    status="IDLE"
                    data={null}
                    reset={vi.fn()}
                    darkMode={false}
                    setDarkMode={vi.fn()}
                    onLogout={onLogout}
                />
            </BrowserRouter>
        );

        const loginBtn = screen.getByRole('button', { name: /Iniciar sesión/i });
        fireEvent.click(loginBtn);
        expect(onLogout).toHaveBeenCalled();
    });
});
