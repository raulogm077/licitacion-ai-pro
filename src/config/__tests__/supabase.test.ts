import { describe, it, expect, vi } from 'vitest';

// Mock the env module before importing supabase
vi.mock('../env', () => ({
    env: {
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'valid-key'
    }
}));

describe('Supabase Configuration', () => {
    it('should initialize client with validated env vars', async () => {
        const { supabase } = await import('../supabase');
        expect(supabase).toBeDefined();
        expect(supabase.auth).toBeDefined();
    });
});
