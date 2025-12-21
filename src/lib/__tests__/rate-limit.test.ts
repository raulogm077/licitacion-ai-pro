import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../rate-limit';

describe('createRateLimiter', () => {
    it('allows requests within the limit (happy path)', () => {
        const limiter = createRateLimiter(1000, 2);
        expect(limiter.check('user').allowed).toBe(true);
        expect(limiter.check('user').allowed).toBe(true);
    });

    it('blocks after exceeding limit (edge case)', () => {
        const limiter = createRateLimiter(1000, 1);
        limiter.check('user');
        const result = limiter.check('user');
        expect(result.allowed).toBe(false);
    });

    it('throws on invalid configuration (error handling)', () => {
        expect(() => createRateLimiter(0, 1)).toThrowError();
        expect(() => createRateLimiter(1000, 0)).toThrowError();
    });
});
