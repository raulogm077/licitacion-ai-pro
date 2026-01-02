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
        const mockStore = {
            isAuthenticated: false,
            user: null,
            signInWithPassword: mockSignInWithPassword,
            signUp: mockSignUp,
            signOut: mockSignOut,
            signInWithMagicLink: vi.fn().mockResolvedValue({ success: true })
        };

        // Mock the hook implementation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(AuthStore.useAuthStore).mockReturnValue(mockStore as unknown as any);

        // Mock the static getState method which is now used in AuthModal
        AuthStore.useAuthStore.getState = vi.fn().mockReturnValue(mockStore);
    });

    it('should show login restrictions when unauthenticated', () => {
        render(
            <BrowserRouter>
                <HomePage />
            </BrowserRouter>
        );

        expect(screen.getByText('auth.required_title')).toBeInTheDocument();
    });

    it('should open AuthModal with Password form', async () => {
        render(
            <BrowserRouter>
                <HomePage />
            </BrowserRouter>
        );

        // Button shows translated text "Iniciar Sesión", not the i18n key
        const loginButton = screen.getByRole('button', { name: /iniciar sesión/i });

        await waitFor(async () => {
            fireEvent.click(loginButton);
            expect(await screen.findByRole('heading', { name: 'Iniciar Sesión' }, { timeout: 3000 })).toBeInTheDocument();
        });

        expect(screen.getByPlaceholderText(/••••••••/)).toBeInTheDocument(); // Password field check
    });

    it('should call signInWithPassword on form submission', async () => {
        mockSignInWithPassword.mockResolvedValue({ success: true });

        render(<AuthModal isOpen={true} onClose={vi.fn()} />);

        const emailInput = screen.getByTestId('email-input');
        const passwordInput = screen.getByTestId('password-input');
        const submitButton = screen.getByTestId('submit-button');

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockSignInWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
        });

        const successEl = await screen.findByTestId('auth-success');
        expect(successEl.textContent).toMatch(/¡Inicio de sesión exitoso!/i);
    });

    it('should handle login error', async () => {
        mockSignInWithPassword.mockResolvedValue({ success: false, error: 'Invalid credentials' });

        render(<AuthModal isOpen={true} onClose={vi.fn()} />);

        const emailInput = screen.getByTestId('email-input');
        const passwordInput = screen.getByTestId('password-input');
        const submitButton = screen.getByTestId('submit-button');

        fireEvent.change(emailInput, { target: { value: 'bad@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
        fireEvent.click(submitButton);

        const errorEl = await screen.findByTestId('auth-error');
        expect(errorEl.textContent).toMatch(/Invalid credentials/i);
    });

    it('should switch to signup and call signUp', async () => {
        mockSignUp.mockResolvedValue({ success: true });

        render(<AuthModal isOpen={true} onClose={vi.fn()} />);

        // Switch to signup
        const signupLink = screen.getByTestId('toggle-mode-button');
        fireEvent.click(signupLink);

        expect(await screen.findByRole('heading', { name: /crear cuenta/i })).toBeInTheDocument();

        const emailInput = screen.getByTestId('email-input');
        const passwordInput = screen.getByTestId('password-input');
        const submitButton = screen.getByTestId('submit-button');

        fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'newpass123' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'newpass123');
        });

        // Wait for success message to appear, which replaces the form
        // Success message for signup uses a different structure
        const successEl = await screen.findByTestId('signup-success');
        expect(successEl.textContent).toMatch(/¡Cuenta Creada!/i);
    });
});
