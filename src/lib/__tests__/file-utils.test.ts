import { describe, it, expect } from 'vitest';
import { validateBufferMagicBytes, readFileAsBase64, bufferToBase64, processFile } from '../file-utils';

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

    describe('processFile', () => {
        it('processes a valid PDF file correctly', async () => {
            // PDF Magic Bytes: %PDF-1.4...
            const content = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
            const file = new File([content], 'test.pdf', { type: 'application/pdf' });

            // JSDOM File objects might not support arrayBuffer(), mock it
            file.arrayBuffer = () => {
                // Ensure the returned buffer is compatible with the crypto.subtle context
                const buffer = new ArrayBuffer(content.length);
                const view = new Uint8Array(buffer);
                view.set(content);
                return Promise.resolve(buffer);
            };

            const result = await processFile(file);

            expect(result.isValidPdf).toBe(true);
            expect(result.hash).toBeTypeOf('string');
            expect(result.hash.length).toBe(64); // SHA-256 hash is 64 hex characters
            expect(result.base64).toBe(btoa(String.fromCharCode(...content)));
        });

        it('processes a non-PDF file correctly', async () => {
            // Some random text content instead of PDF magic bytes
            const contentText = 'Hello World! This is not a PDF.';
            const content = new TextEncoder().encode(contentText);
            const file = new File([content], 'test.txt', { type: 'text/plain' });

            file.arrayBuffer = () => {
                // Ensure the returned buffer is compatible with the crypto.subtle context
                const buffer = new ArrayBuffer(content.length);
                const view = new Uint8Array(buffer);
                view.set(content);
                return Promise.resolve(buffer);
            };

            const result = await processFile(file);

            expect(result.isValidPdf).toBe(false);
            expect(result.hash).toBeTypeOf('string');
            expect(result.hash.length).toBe(64);
            expect(result.base64).toBe(btoa(contentText));
        });

        it('throws an error if arrayBuffer reading fails', async () => {
            const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

            file.arrayBuffer = () => Promise.reject(new Error('Failed to read'));

            await expect(processFile(file)).rejects.toThrow('Failed to read');
        });
    });
});
