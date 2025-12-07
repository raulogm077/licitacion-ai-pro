
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePerformanceCache } from '../usePerformanceCache';

describe('usePerformanceCache', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should store and retrieve values', () => {
        const { result } = renderHook(() => usePerformanceCache<string>());

        act(() => {
            result.current.set('key1', 'value1');
        });

        expect(result.current.get('key1')).toBe('value1');
        expect(result.current.has('key1')).toBe(true);
    });

    it('should return null for missing keys', () => {
        const { result } = renderHook(() => usePerformanceCache<string>());
        expect(result.current.get('missing')).toBeNull();
    });

    it('should expire items after TTL', () => {
        const ttl = 1000;
        const { result } = renderHook(() => usePerformanceCache<string>({ ttl }));

        act(() => {
            result.current.set('key1', 'value1');
        });

        expect(result.current.get('key1')).toBe('value1');

        // Advance time past TTL
        act(() => {
            vi.advanceTimersByTime(ttl + 100);
        });

        expect(result.current.get('key1')).toBeNull();
        expect(result.current.has('key1')).toBe(false);
    });

    it('should respect custom TTL per item', () => {
        const defaultTtl = 1000;
        const customTtl = 5000;
        const { result } = renderHook(() => usePerformanceCache<string>({ ttl: defaultTtl }));

        act(() => {
            result.current.set('default', 'val1');
            result.current.set('custom', 'val2', customTtl);
        });

        // Advance past default TTL but before custom TTL
        act(() => {
            vi.advanceTimersByTime(defaultTtl + 100);
        });

        expect(result.current.get('default')).toBeNull();
        expect(result.current.get('custom')).toBe('val2');

        // Advance past custom TTL
        act(() => {
            vi.advanceTimersByTime(customTtl);
        });

        expect(result.current.get('custom')).toBeNull();
    });

    it('should clear all items', () => {
        const { result } = renderHook(() => usePerformanceCache<string>());

        act(() => {
            result.current.set('k1', 'v1');
            result.current.set('k2', 'v2');
            result.current.clear();
        });

        expect(result.current.get('k1')).toBeNull();
        expect(result.current.get('k2')).toBeNull();
    });
});
