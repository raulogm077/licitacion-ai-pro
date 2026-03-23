import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, Result } from '../Result';

describe('Result', () => {
    describe('ok', () => {
        it('creates a successful result', () => {
            const result = ok(42);
            expect(result.ok).toBe(true);
            expect(result.value).toBe(42);
        });

        it('works with complex types', () => {
            const result = ok({ name: 'test', items: [1, 2, 3] });
            expect(result.ok).toBe(true);
            expect(result.value).toEqual({ name: 'test', items: [1, 2, 3] });
        });
    });

    describe('err', () => {
        it('creates a failed result', () => {
            const result = err(new Error('fail'));
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe('fail');
            }
        });

        it('works with custom error types', () => {
            const result = err<string, { code: number; msg: string }>({ code: 404, msg: 'not found' });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe(404);
            }
        });
    });

    describe('isOk', () => {
        it('returns true for ok result', () => {
            const result: Result<number> = ok(1);
            expect(isOk(result)).toBe(true);
        });

        it('returns false for err result', () => {
            const result: Result<number> = err(new Error('x'));
            expect(isOk(result)).toBe(false);
        });
    });

    describe('isErr', () => {
        it('returns true for err result', () => {
            const result: Result<number> = err(new Error('x'));
            expect(isErr(result)).toBe(true);
        });

        it('returns false for ok result', () => {
            const result: Result<number> = ok(1);
            expect(isErr(result)).toBe(false);
        });
    });
});
