import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.unmock('../env');

describe('Environment Configuration', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('should mark config as invalid if required vars are missing', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', '');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

        const { envConfig } = await import('../env');
        expect(envConfig.isValid).toBe(false);
        // expect(envConfig.errors.VITE_SUPABASE_URL).toBeDefined(); // Adjust based on error format
    });

    it('should mark config as invalid if URL format is wrong', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'not-a-url');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key');

        const { envConfig } = await import('../env');
        expect(envConfig.isValid).toBe(false);
        // expect(envConfig.errors?.VITE_SUPABASE_URL).toBeDefined();
    });

    it('should export env object if vars are valid', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'https://example.com');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key');

        const { env, envConfig } = await import('../env');
        expect(envConfig.isValid).toBe(true);
        expect(env.VITE_SUPABASE_URL).toBe('https://example.com');
    });
});
