import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock matchMedia for UI components (Radix UI etc often need this)
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock environment variables so zod validation in env.ts passes in tests
// Ensure this happens before env.ts is evaluated in tests.
vi.mock('../config/env', () => ({
    env: {
        VITE_SUPABASE_URL: 'https://mock.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
    },
    envConfig: {
        isValid: true,
        errors: null,
        values: {
            VITE_SUPABASE_URL: 'https://mock.supabase.co',
            VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
        },
    },
}));

// Mock i18next
vi.mock('react-i18next', () => ({
    // this mock makes sure any components using the translate hook can use it without a warning being shown
    useTranslation: () => {
        return {
            t: (str: string) => str,
            i18n: {
                changeLanguage: () => new Promise(() => {}),
            },
        };
    },
    initReactI18next: {
        type: '3rdParty',
        init: () => {},
    },
    Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock LocalStorage
Object.defineProperty(window, 'localStorage', {
    value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
    },
    writable: true,
});
