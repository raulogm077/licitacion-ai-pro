import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { authService } from '../services/auth.service';

interface AuthState {
    user: User | null;
    session: Session | null;
    loading: boolean;
    isAuthenticated: boolean;

    // Actions
    initialize: () => Promise<void>;

    signInWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    setUser: (user: User | null, session: Session | null) => void;
    reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    loading: true,
    isAuthenticated: false,

    initialize: async () => {
        set({ loading: true });

        try {
            // 1. Initial Session Check (Standard)
            const { session: currentSession, error: checkError } = await authService.getSession();

            if (!checkError && currentSession) {
                set({
                    user: currentSession.user,
                    session: currentSession,
                    isAuthenticated: true,
                    loading: false
                });
            }

            // 2. Manual Hash Handling Fallback (Only if session check failed or for first-time login)
            const hash = window.location.hash;
            if (hash && hash.includes('access_token')) {
                const params = new URLSearchParams(hash.substring(1));
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');

                if (accessToken && refreshToken) {
                    const { user, session, error } = await authService.setSession(accessToken, refreshToken);
                    if (!error && session) {
                        window.history.replaceState(null, '', window.location.pathname);
                        set({ user, session, isAuthenticated: true });
                    }
                }
            }

            // 3. Subscription
            authService.onAuthStateChange((user, session) => {
                set({
                    user,
                    session,
                    isAuthenticated: !!user,
                    loading: false
                });
            });

        } catch (err) {
            console.error('💥 Auth Initialization Error:', err);
            set({ user: null, session: null, isAuthenticated: false });
        } finally {
            set({ loading: false });
        }
    },



    signInWithPassword: async (email: string, password: string) => {
        const { user, session, error } = await authService.signInWithPassword(email, password);

        if (error) {
            return { success: false, error: error.message };
        }

        set({
            user,
            session,
            isAuthenticated: !!user
        });

        return { success: true };
    },

    signUp: async (email: string, password: string) => {
        const { user, session, error } = await authService.signUp(email, password);

        if (error) {
            return { success: false, error: error.message };
        }

        set({
            user,
            session,
            isAuthenticated: !!user
        });

        return { success: true };
    },

    signOut: async () => {
        await authService.signOut();
        set({
            user: null,
            session: null,
            isAuthenticated: false
        });
    },

    setUser: (user: User | null, session: Session | null) => {
        set({
            user,
            session,
            isAuthenticated: !!user
        });
    },
    reset: () => set({ user: null, session: null, isAuthenticated: false, loading: false })
}));
