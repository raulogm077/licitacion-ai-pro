import { describe, it, expect } from 'vitest';
import { validateBufferMagicBytes, readFileAsBase64, bufferToBase64 } from '../file-utils';

describe('file-utils', () => {


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
});
