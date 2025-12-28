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

    describe('signInWithMagicLink', () => {
        it('should call signInWithOtp and return user/session', async () => {
            const mockResponse = {
                data: { user: { id: '123' }, session: { access_token: 'abc' } },
                error: null
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue(mockResponse as any);

            const result = await authService.signInWithMagicLink('test@example.com');

            expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
                email: 'test@example.com',
                options: { emailRedirectTo: window.location.origin }
            });
            expect(result.user).toEqual(mockResponse.data.user);
            expect(result.session).toEqual(mockResponse.data.session);
            expect(result.error).toBeNull();
        });

        it('should return error if sign in fails', async () => {
            const mockResponse = {
                data: { user: null, session: null },
                error: { message: 'Auth error' }
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue(mockResponse as any);

            const result = await authService.signInWithMagicLink('test@example.com');

            expect(result.error).toEqual(mockResponse.error);
        });
    });

    describe('signInWithPassword', () => {
        it('should call signInWithPassword correctly', async () => {
            const mockResponse = {
                data: { user: { id: '123' }, session: { access_token: 'abc' } },
                error: null
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(mockResponse as any);

            const result = await authService.signInWithPassword('test@example.com', 'password');

            expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password'
            });
            expect(result.user).toEqual({ id: '123' });
        });
    });

    describe('signUp', () => {
        it('should call signUp correctly', async () => {
            const mockResponse = {
                data: { user: { id: 'new' }, session: null },
                error: null
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            vi.mocked(supabase.auth.signUp).mockResolvedValue(mockResponse as any);

            const result = await authService.signUp('new@example.com', 'password');

            expect(supabase.auth.signUp).toHaveBeenCalledWith({
                email: 'new@example.com',
                password: 'password',
                options: { emailRedirectTo: window.location.origin }
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
                error: null
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            vi.mocked(supabase.auth.getSession).mockResolvedValue(mockResponse as any);

            const result = await authService.getSession();
            expect(result.session).toEqual(mockResponse.data.session);
        });
    });
});
