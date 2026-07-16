import { describe, it, expect } from 'vitest';
import { validateBufferMagicBytes, bufferToBase64, inspectFile } from '../file-utils';

describe('file-utils', () => {
    // readFileAsBase64 requires valid FileReader which is tricky in JSDOM sometimes,
    // but usually supported.

    describe('validateBufferMagicBytes', () => {
        it('returns true for valid PDF header', () => {
            const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer;
            expect(validateBufferMagicBytes(buffer)).toBe(true);
        });

        it('returns false for invalid header', () => {
            const buffer = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
            expect(validateBufferMagicBytes(buffer)).toBe(false);
        });
    });

    describe('bufferToBase64', () => {
        it('converts buffer to base64', async () => {
            const content = 'Hello';
            const buffer = new TextEncoder().encode(content).buffer;
            // Expected base64 for "Hello" is "SGVsbG8="
            // However, Blob/FileReader might add data URI scheme, our util strips it

            // Note: Since we use Blob/FileReader inside bufferToBase64, and JSDOM supports it partially,
            // the result should be consistent with readFileAsBase64 logic.

            const result = await bufferToBase64(buffer);
            expect(result).toBe(btoa(content));
        });
    });

    describe('inspectFile', () => {
        it('returns SHA-256 and PDF validity without creating base64 data', async () => {
            const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
            const file = new File([bytes], 'pliego.pdf', {
                type: 'application/pdf',
            });
            Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });

            const result = await inspectFile(file);

            expect(result.isValidPdf).toBe(true);
            expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
            expect(result).not.toHaveProperty('base64');
        });
    });
});
