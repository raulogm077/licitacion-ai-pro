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

        try {
            // Check for hash in URL
            // Supabase sometimes fails to auto-detect hash in implicit flow if strict mode or race conditions occur.
            // We manually parse it as a fallback.
            const hash = window.location.hash;
            if (hash && hash.includes('access_token')) {
                console.log('🔗 Detectado token en URL, procesando manualmente...');

                // Parse hash params
                const params = new URLSearchParams(hash.substring(1)); // remove #
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');


                if (accessToken && refreshToken) {
                    console.log('manual: setting session from hash');
                    const { user, session, error: setSessionError } = await authService.setSession(accessToken, refreshToken);

                    if (setSessionError || !session) {
                        console.error('❌ Error setting session manually (or expired):', setSessionError);
                        // Do NOT return here, fall through to try getSession as last resort or cleanup
                        // Optionally clear hash if invalid to avoid infinite loops?
                        // window.history.replaceState(null, '', window.location.pathname);
                    } else {
                        console.log('✅ Manual session set successfully');
                        // Clean URL
                        window.history.replaceState(null, '', window.location.pathname);
                        set({
                            user: user,
                            session: session,
                            isAuthenticated: true,
                            loading: false
                        });
                        return; // Exit early as we have session
                    }
                }
            }

            // Standard Get current session check
            const { session, error } = await authService.getSession();

            if (error) {
                console.error('Error initializing auth:', error);
                set({ user: null, session: null, isAuthenticated: false });
            } else {
                console.log('Auth initialized:', session ? 'Logged In' : 'Anon');
                set({
                    user: session?.user ?? null,
                    session,
                    isAuthenticated: !!session?.user
                });
            }

            // Listen for auth changes
            authService.onAuthStateChange((user, session) => {
                console.log('🔄 Auth State Changed:', user ? 'User Active' : 'No User');
                set({
                    user,
                    session,
                    isAuthenticated: !!user,
                    loading: false // Ensure loading is false on change
                });
            });

        } catch (err) {
            console.error('💥 Critical Auth Initialization Error:', err);
            set({ user: null, session: null, isAuthenticated: false });
        } finally {
            set({ loading: false });
        }
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
