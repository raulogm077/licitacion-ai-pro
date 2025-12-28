import { describe, it, expect } from 'vitest';
import { LicitacionAIError } from '../../services/ai.service';

describe('LicitacionAIError', () => {
    it('stores message and original error', () => {
        const original = new Error('root cause');
        const err = new LicitacionAIError('Custom message', original);

        expect(err.message).toBe('Custom message');
        expect(err.originalError).toBe(original);
        expect(err.name).toBe('LicitacionAIError');
        expect(err instanceof Error).toBe(true);
    });

    it('works without original error', () => {
        const err = new LicitacionAIError('Just message');
        expect(err.message).toBe('Just message');
        expect(err.originalError).toBeUndefined();
    });
});
