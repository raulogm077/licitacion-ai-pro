import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Supabase Configuration', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    // Environment is managed per test via stubEnv

    it('should initialize client if env vars are present', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'valid-key');

        const { supabase } = await import('../supabase');
        // If client is initialized, accessing properties shouldn't throw the specific error
        // Note: createClient returns an object. Accessing 'from' should work (or be a function)
        expect(supabase).toBeDefined();
        // We can't easily check if it's a Proxy or real client without checking behavior
        // Real client has 'auth', 'from', etc.
        expect(supabase.auth).toBeDefined();
    });

    it('should return a Proxy that throws on access if env vars are missing', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', '');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

        const { supabase } = await import('../supabase');

        expect(supabase).toBeDefined();

        // Accessing methods should throw
        expect(() => supabase.from('table')).toThrow(/Supabase Client Error/);
        expect(() => supabase.auth.getSession()).toThrow(/Supabase Client Error/);
    });

    it('should safely handle "then" access (Promise interop)', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', '');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

        const { supabase } = await import('../supabase');

        // Accessing 'then' should return undefined, not throw
        // @ts-ignore
        expect(supabase.then).toBeUndefined();
    });
});
