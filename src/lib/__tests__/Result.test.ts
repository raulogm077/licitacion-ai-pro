import { describe, it, expect } from 'vitest';
import { ok, err } from '../Result';

describe('Result type pattern', () => {
    describe('ok()', () => {
        it('should create a successful result with a value', () => {
            const value = 'success data';
            const result = ok(value);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(value);
            }
        });

        it('should work with different types of values', () => {
            const numResult = ok(42);
            expect(numResult.ok).toBe(true);
            if (numResult.ok) {
                expect(numResult.value).toBe(42);
            }

            const objResult = ok({ key: 'value' });
            expect(objResult.ok).toBe(true);
            if (objResult.ok) {
                expect(objResult.value).toEqual({ key: 'value' });
            }

            const nullResult = ok(null);
            expect(nullResult.ok).toBe(true);
            if (nullResult.ok) {
                expect(nullResult.value).toBe(null);
            }
        });
    });

    describe('err()', () => {
        it('should create a failed result with an error', () => {
            const error = new Error('something went wrong');
            const result = err(error);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe(error);
            }
        });

        it('should work with custom error types', () => {
            const customError = 'Custom Error String';
            const result = err(customError);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe(customError);
            }
        });

        it('should work with null as error', () => {
            const result = err(null);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe(null);
            }
        });
    });
});
