import { beforeAll, afterAll } from 'vitest';

// Supress console.error during tests to avoid false positives in CI logs
// We keep it for failed assertions, but not for "expected" error logs
const originalConsoleError = console.error;

beforeAll(() => {
    console.error = (...args: unknown[]) => {
        // Filter out expected errors we are intentionally testing
        if (
            typeof args[0] === 'string' &&
            (args[0].includes('Supabase Error') ||
                args[0].includes('CRITICAL AI ERROR') ||
                args[0].includes('Error guardando') ||
                args[0].includes('Safety/Recitation') ||
                args[0].includes('Magic Bytes') ||
                args[0].includes('API Key no configurada'))
        ) {
            return;
        }
        originalConsoleError(...args);
    };
});

afterAll(() => {
    console.error = originalConsoleError;
});
