import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../App';

// Mock pages to avoid full render
vi.mock('../../features/dashboard/Dashboard', () => ({
    Dashboard: () => <div>Dashboard Page</div>
}));

vi.mock('../services/db.service', () => ({
    LoginPage: () => <div>Login Page</div>
}));

// Mock Supabase to handle session state
vi.mock('../config/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
            onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
        }
    }
}));

describe('App', () => {
    it('renders login page when no session', async () => {
        // Mock session null is default
        render(<App />);

        // Use findBy because of useEffect async session check
        expect(await screen.findByText('Iniciar Sesión')).toBeInTheDocument();
    });

    // Note: Testing authenticated state requires mocking the module return value before render, 
    // which is tricky with hoisted mocks in separate tests without complex setup. 
    // We will focus on unauthed for now to keep it simple and robust.
});
