
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Polyfill for Blob.arrayBuffer (missing in some jsdom versions or environments)
if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function () {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (reader.result instanceof ArrayBuffer) {
                    resolve(reader.result);
                } else {
                    // Should not happen if readAsArrayBuffer is used
                    resolve(new ArrayBuffer(0));
                }
            };
            reader.readAsArrayBuffer(this);
        });
    };
}

// Runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
    cleanup();
});


// Mock localStorage
const localStorageMock = (function () {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value.toString();
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
    };
})();
Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
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
