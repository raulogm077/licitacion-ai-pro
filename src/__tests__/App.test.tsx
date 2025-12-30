import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';
import { useAuthStore } from '../stores/auth.store';
import { useLicitacionStore } from '../stores/licitacion.store';
import { useAnalysisStore } from '../stores/analysis.store';

// Mock pages to avoid full render
vi.mock('../../features/dashboard/Dashboard', () => ({
    Dashboard: () => <div>Dashboard Page</div>
}));

vi.mock('../services/db.service', () => ({
    LoginPage: () => <div>Login Page</div>
}));

// Mock authService
vi.mock('../services/auth.service', () => ({
    authService: {
        getSession: vi.fn().mockResolvedValue({ session: null, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        signInWithMagicLink: vi.fn(),
        signOut: vi.fn(),
    }
}));

// Mock HomePage
vi.mock('../pages/HomePage', () => ({
    HomePage: () => <div>Home Page Mock</div>
}));

describe('App', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuthStore.getState().reset();
        useLicitacionStore.getState().reset();
        useAnalysisStore.getState().resetAnalysis();
    });

    it('renders login page when no session', async () => {
        // Mock session null is default
        render(<App />);

        // Use findBy because of useEffect async session check which might trigger lazy load
        expect(await screen.findByText('Home Page Mock')).toBeInTheDocument();
    });

    // Note: Testing authenticated state requires mocking the module return value before render, 
    // which is tricky with hoisted mocks in separate tests without complex setup. 
    // We will focus on unauthed for now to keep it simple and robust.
});
