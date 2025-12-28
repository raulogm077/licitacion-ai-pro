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
    signInWithMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
    signInWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    setUser: (user: User | null, session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    loading: true,
    isAuthenticated: false,

    initialize: async () => {
        set({ loading: true });

        // Get current session
        const { session, error } = await authService.getSession();

        if (error) {
            console.error('Error initializing auth:', error);
            set({ user: null, session: null, loading: false, isAuthenticated: false });
            return;
        }

        set({
            user: session?.user ?? null,
            session,
            loading: false,
            isAuthenticated: !!session?.user
        });

        // Listen for auth changes
        authService.onAuthStateChange((user, session) => {
            set({
                user,
                session,
                isAuthenticated: !!user
            });
        });
    },

    signInWithMagicLink: async (email: string) => {
        const { error } = await authService.signInWithMagicLink(email);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
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
    }
}));
