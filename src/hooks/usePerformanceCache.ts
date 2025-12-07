import { useRef, useCallback } from 'react';

interface CacheEntry<T> {
    data: T;
    expiry: number;
}

interface CacheOptions {
    ttl?: number; // Time to live in milliseconds (default: 5 minutes)
}

export function usePerformanceCache<T>(options: CacheOptions = {}) {
    const { ttl = 5 * 60 * 1000 } = options; // Default 5 minutes
    const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());

    const get = useCallback((key: string): T | null => {
        const entry = cacheRef.current.get(key);

        if (!entry) {
            return null;
        }

        // Check if expired
        if (Date.now() > entry.expiry) {
            cacheRef.current.delete(key);
            return null;
        }

        return entry.data;
    }, []);

    const set = useCallback((key: string, data: T, customTtl?: number) => {
        const expiryTime = Date.now() + (customTtl || ttl);
        cacheRef.current.set(key, {
            data,
            expiry: expiryTime,
        });
    }, [ttl]);

    const invalidate = useCallback((key: string) => {
        cacheRef.current.delete(key);
    }, []);

    const clear = useCallback(() => {
        cacheRef.current.clear();
    }, []);

    const has = useCallback((key: string): boolean => {
        const entry = cacheRef.current.get(key);
        if (!entry) return false;

        if (Date.now() > entry.expiry) {
            cacheRef.current.delete(key);
            return false;
        }

        return true;
    }, []);

    return {
        get,
        set,
        invalidate,
        clear,
        has,
    };
}
