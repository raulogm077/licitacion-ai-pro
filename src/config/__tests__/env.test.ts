import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Environment Configuration', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('should mark config as invalid if required vars are missing', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', '');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

        const { configStatus } = await import('../env');
        expect(configStatus.isValid).toBe(false);
        expect(configStatus.missingKeys).toContain('VITE_SUPABASE_URL');
        expect(configStatus.missingKeys).toContain('VITE_SUPABASE_ANON_KEY');
    });

    it('should mark config as invalid if URL format is wrong', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'not-a-url');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key');

        const { configStatus } = await import('../env');
        expect(configStatus.isValid).toBe(false);
        expect(configStatus.missingKeys).toContain('VITE_SUPABASE_URL');
    });

    it('should export env object if vars are valid', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'https://example.com');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key');

        const { env, configStatus } = await import('../env');
        expect(configStatus.isValid).toBe(true);
        expect(env.VITE_SUPABASE_URL).toBe('https://example.com');
    });
});
