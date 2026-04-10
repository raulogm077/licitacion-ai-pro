import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDarkMode } from '../useDarkMode';

describe('useDarkMode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset html element classList
        document.documentElement.classList.remove('dark');
        // Reset matchMedia to return false (light mode preference)
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    it('initializes from localStorage when saved value is true', () => {
        vi.mocked(window.localStorage.getItem).mockReturnValue('true');
        const { result } = renderHook(() => useDarkMode());
        expect(result.current[0]).toBe(true);
    });

    it('initializes from localStorage when saved value is false', () => {
        vi.mocked(window.localStorage.getItem).mockReturnValue('false');
        const { result } = renderHook(() => useDarkMode());
        expect(result.current[0]).toBe(false);
    });

    it('falls back to matchMedia when no localStorage value', () => {
        vi.mocked(window.localStorage.getItem).mockReturnValue(null);
        // matchMedia returns false (light mode)
        const { result } = renderHook(() => useDarkMode());
        expect(result.current[0]).toBe(false);
    });

    it('falls back to matchMedia dark preference when no localStorage value', () => {
        vi.mocked(window.localStorage.getItem).mockReturnValue(null);
        // matchMedia returns true (dark preference)
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: true,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
        const { result } = renderHook(() => useDarkMode());
        expect(result.current[0]).toBe(true);
    });

    it('adds "dark" class to html element when darkMode is true', () => {
        vi.mocked(window.localStorage.getItem).mockReturnValue('true');
        renderHook(() => useDarkMode());
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes "dark" class from html element when darkMode is false', () => {
        document.documentElement.classList.add('dark');
        vi.mocked(window.localStorage.getItem).mockReturnValue('false');
        renderHook(() => useDarkMode());
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('persists to localStorage when toggled', () => {
        vi.mocked(window.localStorage.getItem).mockReturnValue('false');
        const { result } = renderHook(() => useDarkMode());

        act(() => {
            result.current[1](true);
        });

        expect(window.localStorage.setItem).toHaveBeenCalledWith('darkMode', 'true');
    });

    it('toggles dark class on html element when set to true', () => {
        vi.mocked(window.localStorage.getItem).mockReturnValue('false');
        const { result } = renderHook(() => useDarkMode());

        act(() => {
            result.current[1](true);
        });

        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('returns a tuple [darkMode, setDarkMode]', () => {
        vi.mocked(window.localStorage.getItem).mockReturnValue('false');
        const { result } = renderHook(() => useDarkMode());
        expect(Array.isArray(result.current)).toBe(true);
        expect(typeof result.current[0]).toBe('boolean');
        expect(typeof result.current[1]).toBe('function');
    });
});
