import { describe, it, expect, vi } from 'vitest';

// Mock the env module before importing supabase
vi.mock('../env', () => {
    return {
        __esModule: true,
        env: {
            VITE_SUPABASE_URL: 'https://example.supabase.co',
            VITE_SUPABASE_ANON_KEY: 'valid-key',
        },
        envConfig: {
            isValid: true,
            errors: null,
            values: {},
        },
    };
});

describe('Supabase Configuration', () => {
    it('should initialize client with validated env vars', async () => {
        const { supabase } = await import('../supabase');
        expect(supabase).toBeDefined();
        expect(supabase.auth).toBeDefined();
    });
});
