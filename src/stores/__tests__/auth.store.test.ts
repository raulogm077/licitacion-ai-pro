import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../auth.store';
import { authService } from '../../services/auth.service';

vi.mock('../../services/auth.service', () => ({
    authService: {
        getSession: vi.fn(),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        setSession: vi.fn(),
        onAuthStateChange: vi.fn(),
    },
}));

vi.mock('../../services/logger', () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('Auth Store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuthStore.setState({
            user: null,
            session: null,
            loading: true,
            isAuthenticated: false,
        });
    });

    describe('signInWithPassword', () => {
        it('should set user on successful login', async () => {
            const mockUser = { id: '1', email: 'test@test.com' };
            const mockSession = { access_token: 'token' };
            vi.mocked(authService.signInWithPassword).mockResolvedValue({
                user: mockUser,
                session: mockSession,
                error: null,
            } as unknown as Awaited<ReturnType<typeof authService.signInWithPassword>>);

            const result = await useAuthStore.getState().signInWithPassword('test@test.com', 'pass');

            expect(result.success).toBe(true);
            expect(useAuthStore.getState().isAuthenticated).toBe(true);
            expect(useAuthStore.getState().user).toEqual(mockUser);
        });

        it('should return error on failed login', async () => {
            vi.mocked(authService.signInWithPassword).mockResolvedValue({
                user: null,
                session: null,
                error: { message: 'Invalid credentials' },
            } as unknown as Awaited<ReturnType<typeof authService.signInWithPassword>>);

            const result = await useAuthStore.getState().signInWithPassword('test@test.com', 'wrong');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid credentials');
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });
    });

    describe('signUp', () => {
        it('should set user on successful signup', async () => {
            const mockUser = { id: '2', email: 'new@test.com' };
            vi.mocked(authService.signUp).mockResolvedValue({
                user: mockUser,
                session: null,
                error: null,
            } as unknown as Awaited<ReturnType<typeof authService.signUp>>);

            const result = await useAuthStore.getState().signUp('new@test.com', 'pass');

            expect(result.success).toBe(true);
            expect(useAuthStore.getState().user).toEqual(mockUser);
        });

        it('should return error on failed signup', async () => {
            vi.mocked(authService.signUp).mockResolvedValue({
                user: null,
                session: null,
                error: { message: 'Email taken' },
            } as unknown as Awaited<ReturnType<typeof authService.signUp>>);

            const result = await useAuthStore.getState().signUp('taken@test.com', 'pass');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Email taken');
        });
    });

    describe('signOut', () => {
        it('should clear state on signout', async () => {
            useAuthStore.setState({ user: { id: '1' } as unknown as null, isAuthenticated: true });
            vi.mocked(authService.signOut).mockResolvedValue(
                undefined as unknown as Awaited<ReturnType<typeof authService.signOut>>
            );

            await useAuthStore.getState().signOut();

            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(useAuthStore.getState().user).toBeNull();
            expect(useAuthStore.getState().session).toBeNull();
        });
    });

    describe('setUser', () => {
        it('should set user and session', () => {
            const mockUser = { id: '1' } as unknown as null;
            const mockSession = { access_token: 'tk' } as unknown as null;

            useAuthStore.getState().setUser(mockUser, mockSession);

            expect(useAuthStore.getState().user).toEqual(mockUser);
            expect(useAuthStore.getState().session).toEqual(mockSession);
            expect(useAuthStore.getState().isAuthenticated).toBe(true);
        });

        it('should set unauthenticated when user is null', () => {
            useAuthStore.getState().setUser(null, null);

            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });
    });

    describe('reset', () => {
        it('should reset all state', () => {
            useAuthStore.setState({ user: { id: '1' } as unknown as null, isAuthenticated: true, loading: true });

            useAuthStore.getState().reset();

            expect(useAuthStore.getState().user).toBeNull();
            expect(useAuthStore.getState().session).toBeNull();
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(useAuthStore.getState().loading).toBe(false);
        });
    });

    describe('initialize', () => {
        it('should set authenticated state when session exists', async () => {
            const mockSession = { user: { id: '1', email: 'test@test.com' }, access_token: 'tk' };
            vi.mocked(authService.getSession).mockResolvedValue({
                session: mockSession,
                error: null,
            } as unknown as Awaited<ReturnType<typeof authService.getSession>>);
            vi.mocked(authService.onAuthStateChange).mockReturnValue({
                data: { subscription: { unsubscribe: vi.fn() } },
            } as unknown as ReturnType<typeof authService.onAuthStateChange>);

            await useAuthStore.getState().initialize();

            expect(useAuthStore.getState().isAuthenticated).toBe(true);
            expect(useAuthStore.getState().loading).toBe(false);
        });

        it('should handle initialization error', async () => {
            vi.mocked(authService.getSession).mockRejectedValue(new Error('Network error'));

            await useAuthStore.getState().initialize();

            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(useAuthStore.getState().loading).toBe(false);
        });
    });
});
