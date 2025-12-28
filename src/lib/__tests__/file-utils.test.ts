import { describe, it, expect, vi } from 'vitest';
import { validatePdfMagicBytes, generateFileHash, readFileAsBase64 } from '../file-utils';

describe('file-utils', () => {
    describe('validatePdfMagicBytes', () => {
        it('returns true for valid PDF header', async () => {
            const blob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]);
            const file = new File([blob], 'test.pdf');
            expect(await validatePdfMagicBytes(file)).toBe(true);
        });

        it('returns false for invalid header', async () => {
            const blob = new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x00])]);
            const file = new File([blob], 'test.txt');
            expect(await validatePdfMagicBytes(file)).toBe(false);
        });
    });

    describe('generateFileHash', () => {
        it('generates SHA-256 hash', async () => {
            // Mock crypto.subtle
            const mockDigest = vi.fn().mockResolvedValue(new Uint8Array([0xaa, 0xbb]).buffer);
            Object.defineProperty(global, 'crypto', {
                value: {
                    subtle: { digest: mockDigest }
                },
                writable: true
            });

            const file = new File(['content'], 'test.pdf');
            const hash = await generateFileHash(file);

            expect(hash).toBe('aabb');
            expect(mockDigest).toHaveBeenCalledWith('SHA-256', expect.any(ArrayBuffer));
        });
    });

    // readFileAsBase64 requires valid FileReader which is tricky in JSDOM sometimes, 
    // but usually supported.
    describe('readFileAsBase64', () => {
        it('reads file content', async () => {
            const content = 'Hello';
            const file = new File([content], 'test.txt', { type: 'text/plain' });

            // FileReader behavior in JSDOM usually works for simple cases
            // But readAsDataURL produces data:text/plain;base64,SGVsbG8=

            const result = await readFileAsBase64(file);
            expect(result).toBe(btoa(content));
        });
    });
});
