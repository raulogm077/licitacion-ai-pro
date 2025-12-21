import { describe, expect, it } from 'vitest';
import { validatePdfSize, validateBase64Size } from '../analysis-guards';

describe('analysis-guards', () => {
    it('accepts valid PDF sizes (happy path)', () => {
        expect(() => validatePdfSize(1024)).not.toThrow();
    });

    it('rejects oversized PDFs (edge case)', () => {
        expect(() => validatePdfSize(20 * 1024 * 1024, 10 * 1024 * 1024)).toThrowError();
    });

    it('rejects invalid inputs (error handling)', () => {
        expect(() => validatePdfSize(-1)).toThrowError();
        expect(() => validateBase64Size('', 10)).toThrowError();
    });
});
