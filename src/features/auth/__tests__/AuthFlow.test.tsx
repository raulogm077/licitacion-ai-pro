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
    const mockSignIn = vi.fn();
    const mockSignOut = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Default unauthenticated state
        // @ts-ignore
        vi.mocked(AuthStore.useAuthStore).mockReturnValue({
            isAuthenticated: false,
            user: null,
            signInWithMagicLink: mockSignIn,
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

        // Verify "Autenticación requerida" banner
        expect(screen.getByText('Autenticación requerida')).toBeInTheDocument();

        // Verify "Iniciar Sesión" button in drop zone
        const loginButtons = screen.getAllByText(/iniciar sesión/i);
        expect(loginButtons.length).toBeGreaterThan(0);

        // Verify Drag Zone is disabled/shows lock (visual verify via accessibility or text)
        // The text "Inicia sesión para comenzar..." should be present
        expect(screen.getByText(/Inicia sesión para comenzar/i)).toBeInTheDocument();
    });

    it('should open AuthModal when login button is clicked', async () => {
        // We need to render the context where AuthModal is controlled.
        // HomePage has local state for AuthModal.

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

        const loginButton = screen.getAllByText(/iniciar sesión/i)[0]; // Just grab one
        fireEvent.click(loginButton);

        // Modal content should appear
        expect(screen.getByText('Te enviaremos un enlace mágico por email')).toBeInTheDocument();
    });

    it('should call signInWithMagicLink on form submission', async () => {
        mockSignIn.mockResolvedValue({ success: true });

        render(<AuthModal isOpen={true} onClose={vi.fn()} />);

        const emailInput = screen.getByPlaceholderText(/tu@email.com/i);
        const submitButton = screen.getByRole('button', { name: /enviar enlace/i });

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockSignIn).toHaveBeenCalledWith('test@example.com');
        });

        // Should show success
        expect(await screen.findByText('¡Correo enviado!')).toBeInTheDocument();
    });

    it('should handle login error', async () => {
        mockSignIn.mockResolvedValue({ success: false, error: 'Invalid domain' });

        render(<AuthModal isOpen={true} onClose={vi.fn()} />);

        const emailInput = screen.getByPlaceholderText(/tu@email.com/i);
        const submitButton = screen.getByRole('button', { name: /enviar enlace/i });

        fireEvent.change(emailInput, { target: { value: 'bad@example.com' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Invalid domain')).toBeInTheDocument();
        });
    });

    it('should show upload UI when authenticated', () => {
        // Mock authenticated state
        // @ts-ignore
        vi.mocked(AuthStore.useAuthStore).mockReturnValue({
            isAuthenticated: true,
            user: { email: 'user@test.com' },
            signInWithMagicLink: mockSignIn,
            signOut: mockSignOut
        });

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

        // Required banner gone
        expect(screen.queryByText('Autenticación requerida')).not.toBeInTheDocument();

        // Check for Upload UI
        expect(screen.getByText(/Arrastra tu pliego/i)).toBeInTheDocument();
        expect(screen.getByText(/Seleccionar PDF/i)).toBeInTheDocument();
    });
});
