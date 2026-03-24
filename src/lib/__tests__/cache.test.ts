import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimpleCache } from '../cache';

describe('SimpleCache', () => {
    let cache: SimpleCache;

    beforeEach(() => {
        cache = new SimpleCache();
    });

    it('returns null for missing key', () => {
        expect(cache.get('nonexistent')).toBeNull();
    });

    it('stores and retrieves values', () => {
        cache.set('key1', { name: 'test' }, 60000);
        expect(cache.get('key1')).toEqual({ name: 'test' });
    });

    it('returns null for expired entries', () => {
        vi.useFakeTimers();
        cache.set('key1', 'value', 1000);
        expect(cache.get('key1')).toBe('value');

        vi.advanceTimersByTime(1001);
        expect(cache.get('key1')).toBeNull();
        vi.useRealTimers();
    });

    it('invalidates a specific key', () => {
        cache.set('key1', 'v1', 60000);
        cache.set('key2', 'v2', 60000);
        cache.invalidate('key1');
        expect(cache.get('key1')).toBeNull();
        expect(cache.get('key2')).toBe('v2');
    });

    it('invalidates by prefix', () => {
        cache.set('db:all', 'list', 60000);
        cache.set('db:item:1', 'one', 60000);
        cache.set('tpl:all', 'templates', 60000);
        cache.invalidateByPrefix('db:');
        expect(cache.get('db:all')).toBeNull();
        expect(cache.get('db:item:1')).toBeNull();
        expect(cache.get('tpl:all')).toBe('templates');
    });

    it('clears all entries', () => {
        cache.set('a', 1, 60000);
        cache.set('b', 2, 60000);
        cache.clear();
        expect(cache.size).toBe(0);
        expect(cache.get('a')).toBeNull();
    });

    it('reports correct size', () => {
        expect(cache.size).toBe(0);
        cache.set('a', 1, 60000);
        cache.set('b', 2, 60000);
        expect(cache.size).toBe(2);
    });

    it('overwrites existing key', () => {
        cache.set('key', 'old', 60000);
        cache.set('key', 'new', 60000);
        expect(cache.get('key')).toBe('new');
        expect(cache.size).toBe(1);
    });
});
