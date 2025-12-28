import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { HomePage } from '../../../pages/HomePage';
import { AuthModal } from '../../../components/ui/AuthModal';
import * as AuthStore from '../../../stores/auth.store';

// Mock dependencies
vi.mock('../../../stores/auth.store');
vi.mock('../../../hooks/useLicitacionProcessor', () => ({
    useLicitacionProcessor: () => ({
        state: { status: 'IDLE', thinkingOutput: '' },
        processFile: vi.fn(),
        reset: vi.fn(),
        handleDataUpdate: vi.fn(),
    })
}));

// Mock child components that might cause issues
vi.mock('../../../components/domain/TagManager', () => ({ TagManager: () => <div>TagManager</div> }));
vi.mock('../../../components/domain/NotesPanel', () => ({ NotesPanel: () => <div>NotesPanel</div> }));
vi.mock('../../dashboard/Dashboard', () => ({ Dashboard: () => <div>Dashboard</div> }));

describe('Auth Validation Flow', () => {
    const mockSignInWithPassword = vi.fn();
    const mockSignUp = vi.fn();
    const mockSignOut = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Default unauthenticated state

        vi.mocked(AuthStore.useAuthStore).mockReturnValue({
            isAuthenticated: false,
            user: null,
            signInWithPassword: mockSignInWithPassword,
            signUp: mockSignUp,
            signOut: mockSignOut
        });
    });

    it('should show login restrictions when unauthenticated', () => {
        render(
            <BrowserRouter>
                <HomePage
                    state={{ status: 'IDLE', progress: 0, thinkingOutput: '', data: null, error: null }}
                    processFile={vi.fn()}
                    reset={vi.fn()}
                    handleDataUpdate={vi.fn()}
                />
            </BrowserRouter>
        );

        expect(screen.getByText('Autenticación requerida')).toBeInTheDocument();
    });

    it('should open AuthModal with Password form', async () => {
        render(
            <BrowserRouter>
                <HomePage
                    state={{ status: 'IDLE', progress: 0, thinkingOutput: '', data: null, error: null }}
                    processFile={vi.fn()}
                    reset={vi.fn()}
                    handleDataUpdate={vi.fn()}
                />
            </BrowserRouter>
        );

        const loginButton = screen.getAllByText(/iniciar sesión/i)[0];
        fireEvent.click(loginButton);

        expect(screen.getByText('Accede a tu cuenta de analista')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/••••••••/)).toBeInTheDocument(); // Password field check
    });

    it('should call signInWithPassword on form submission', async () => {
        mockSignInWithPassword.mockResolvedValue({ success: true });

        render(<AuthModal isOpen={true} onClose={vi.fn()} />);

        const emailInput = screen.getByPlaceholderText(/tu@email.com/i);
        const passwordInput = screen.getByPlaceholderText(/••••••••/i);
        const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockSignInWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
        });

        expect(await screen.findByText('¡Inicio de sesión exitoso!')).toBeInTheDocument();
    });

    it('should handle login error', async () => {
        mockSignInWithPassword.mockResolvedValue({ success: false, error: 'Invalid credentials' });

        render(<AuthModal isOpen={true} onClose={vi.fn()} />);

        const emailInput = screen.getByPlaceholderText(/tu@email.com/i);
        const passwordInput = screen.getByPlaceholderText(/••••••••/i);
        const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

        fireEvent.change(emailInput, { target: { value: 'bad@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
        });
    });

    it('should switch to signup and call signUp', async () => {
        mockSignUp.mockResolvedValue({ success: true });

        render(<AuthModal isOpen={true} onClose={vi.fn()} />);

        // Switch to signup
        const signupLink = screen.getByText('Regístrate ahora');
        fireEvent.click(signupLink);

        expect(screen.getByText('Crear Cuenta')).toBeInTheDocument();

        const emailInput = screen.getByPlaceholderText(/tu@email.com/i);
        const passwordInput = screen.getByPlaceholderText(/••••••••/i);
        const submitButton = screen.getByRole('button', { name: /registrarse/i });

        fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'newpass123' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'newpass123');
        });

        expect(await screen.findByText('¡Cuenta Creada!')).toBeInTheDocument();
    });
});
