import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../auth.service';
import { supabase } from '../../config/supabase';

// Mock Supabase
vi.mock('../../config/supabase', () => ({
    supabase: {
        auth: {
            signInWithOtp: vi.fn(),
            signInWithPassword: vi.fn(),
            signUp: vi.fn(),
            signOut: vi.fn(),
            setSession: vi.fn(),
            getUser: vi.fn(),
            getSession: vi.fn(),
            onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        },
    },
}));

describe('AuthService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('signInWithPassword', () => {
        it('should call signInWithPassword correctly', async () => {
            const mockResponse = {
                data: { user: { id: '123' }, session: { access_token: 'abc' } },
                error: null,
            };
            vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(
                mockResponse as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>
            );

            const result = await authService.signInWithPassword('test@example.com', 'password');

            expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password',
            });
            expect(result.user).toEqual({ id: '123' });
        });
    });

    describe('signUp', () => {
        it('should call signUp correctly', async () => {
            const mockResponse = {
                data: { user: { id: 'new' }, session: null },
                error: null,
            };
            vi.mocked(supabase.auth.signUp).mockResolvedValue(
                mockResponse as unknown as Awaited<ReturnType<typeof supabase.auth.signUp>>
            );

            const result = await authService.signUp('new@example.com', 'password');

            expect(supabase.auth.signUp).toHaveBeenCalledWith({
                email: 'new@example.com',
                password: 'password',
                options: { emailRedirectTo: window.location.origin },
            });
            expect(result.user).toEqual({ id: 'new' });
        });
    });

    describe('signOut', () => {
        it('should call signOut', async () => {
            vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });
            await authService.signOut();
            expect(supabase.auth.signOut).toHaveBeenCalled();
        });
    });

    describe('getSession', () => {
        it('should return current session', async () => {
            const mockResponse = {
                data: { session: { access_token: 'abc' } },
                error: null,
            };
            vi.mocked(supabase.auth.getSession).mockResolvedValue(
                mockResponse as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>
            );

            const result = await authService.getSession();
            expect(result.session).toEqual(mockResponse.data.session);
        });
    });

    describe('setSession', () => {
        it('should set session from tokens', async () => {
            const mockResponse = {
                data: { user: { id: '1' }, session: { access_token: 'new-token' } },
                error: null,
            };
            vi.mocked(supabase.auth.setSession).mockResolvedValue(
                mockResponse as unknown as Awaited<ReturnType<typeof supabase.auth.setSession>>
            );

            const result = await authService.setSession('access', 'refresh');

            expect(supabase.auth.setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' });
            expect(result.user).toEqual({ id: '1' });
        });
    });

    describe('getCurrentUser', () => {
        it('should return current user', async () => {
            const mockResponse = {
                data: { user: { id: '1', email: 'test@test.com' } },
                error: null,
            };
            vi.mocked(supabase.auth.getUser).mockResolvedValue(
                mockResponse as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>
            );

            const result = await authService.getCurrentUser();
            expect(result.user).toEqual({ id: '1', email: 'test@test.com' });
        });
    });

    describe('onAuthStateChange', () => {
        it('should register listener and forward events', () => {
            const callback = vi.fn();
            let capturedHandler: (event: string, session: unknown) => void = () => {};
            vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((handler) => {
                capturedHandler = handler as typeof capturedHandler;
                return { data: { subscription: { unsubscribe: vi.fn() } } } as unknown as ReturnType<
                    typeof supabase.auth.onAuthStateChange
                >;
            });

            authService.onAuthStateChange(callback);

            // Simulate auth event with session
            capturedHandler('SIGNED_IN', { user: { id: '1' }, access_token: 'tk' });
            expect(callback).toHaveBeenCalledWith({ id: '1' }, { user: { id: '1' }, access_token: 'tk' });

            // Simulate auth event without session
            capturedHandler('SIGNED_OUT', null);
            expect(callback).toHaveBeenCalledWith(null, null);
        });
    });
});
