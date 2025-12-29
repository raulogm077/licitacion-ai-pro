import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Environment Configuration', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('should throw error if required vars are missing', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', '');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

        await expect(import('../env')).rejects.toThrow(/Invalid Environment Configuration/);
    });

    it('should validate URL format', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'not-a-url');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key');

        await expect(import('../env')).rejects.toThrow(/Invalid Environment Configuration/);
    });

    it('should export env object if vars are valid', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'https://example.com');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key');

        const { env } = await import('../env');
        expect(env.VITE_SUPABASE_URL).toBe('https://example.com');
    });
});
