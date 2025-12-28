import { supabase } from '../config/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface AuthResponse {
    user: User | null;
    session: Session | null;
    error: AuthError | null;
}

/**
 * Authentication service using Supabase Auth
 * Provides methods for user authentication with magic links
 */
export class AuthService {
    /**
     * Sign in with magic link (passwordless)
     * User will receive an email with a login link
     */
    async signInWithMagicLink(email: string): Promise<AuthResponse> {
        const { data, error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: import.meta.env.VITE_SITE_URL || window.location.origin,
            }
        });

        return {
            user: data.user,
            session: data.session,
            error
        };
    }

    /**
     * Sign up with email/password (optional, for traditional auth)
     */
    async signUp(email: string, password: string): Promise<AuthResponse> {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: import.meta.env.VITE_SITE_URL || window.location.origin,
            }
        });

        return {
            user: data.user,
            session: data.session,
            error
        };
    }

    /**
     * Sign in with email/password (optional, for traditional auth)
     */
    async signInWithPassword(email: string, password: string): Promise<AuthResponse> {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        return {
            user: data.user,
            session: data.session,
            error
        };
    }

    /**
     * Sign out current user
     */
    async signOut(): Promise<{ error: AuthError | null }> {
        const { error } = await supabase.auth.signOut();
        return { error };
    }

    /**
     * Manually set session from tokens
     */
    async setSession(access_token: string, refresh_token: string): Promise<AuthResponse> {
        const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token
        });
        return {
            user: data.user,
            session: data.session,
            error
        };
    }

    /**
     * Get current authenticated user
     */
    async getCurrentUser(): Promise<{ user: User | null; error: AuthError | null }> {
        const { data, error } = await supabase.auth.getUser();
        return {
            user: data.user,
            error
        };
    }

    /**
     * Get current session
     */
    async getSession(): Promise<{ session: Session | null; error: AuthError | null }> {
        const { data, error } = await supabase.auth.getSession();
        return {
            session: data.session,
            error
        };
    }

    /**
     * Listen to auth state changes
     */
    onAuthStateChange(callback: (user: User | null, session: Session | null) => void) {
        return supabase.auth.onAuthStateChange((_event, session) => {
            callback(session?.user ?? null, session);
        });
    }
}

export const authService = new AuthService();
