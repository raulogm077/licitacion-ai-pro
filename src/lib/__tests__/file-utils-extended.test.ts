import { describe, it, expect } from 'vitest';
import { generateBufferHash, validateBufferMagicBytes } from '../file-utils';

describe('file-utils extended', () => {
    describe('generateBufferHash', () => {
        it('generates a hex hash from buffer', async () => {
            const buffer = new ArrayBuffer(10);
            const hash = await generateBufferHash(buffer);
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
        });

        it('generates consistent hashes for same content', async () => {
            const buf1 = new Uint8Array([1, 2, 3]).buffer;
            const buf2 = new Uint8Array([1, 2, 3]).buffer;
            const hash1 = await generateBufferHash(buf1);
            const hash2 = await generateBufferHash(buf2);
            expect(hash1).toBe(hash2);
        });

        it('generates different hashes for different content', async () => {
            const buf1 = new Uint8Array([1, 2, 3]).buffer;
            const buf2 = new Uint8Array([4, 5, 6]).buffer;
            const hash1 = await generateBufferHash(buf1);
            const hash2 = await generateBufferHash(buf2);
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('validateBufferMagicBytes', () => {
        it('validates PDF magic bytes', () => {
            const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer;
            expect(validateBufferMagicBytes(pdfBytes)).toBe(true);
        });

        it('rejects non-PDF bytes', () => {
            const nonPdf = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
            expect(validateBufferMagicBytes(nonPdf)).toBe(false);
        });

        it('rejects partial PDF header', () => {
            const partial = new Uint8Array([0x25, 0x50, 0x00, 0x00]).buffer;
            expect(validateBufferMagicBytes(partial)).toBe(false);
        });

        it('handles empty buffer', () => {
            const empty = new ArrayBuffer(0);
            expect(validateBufferMagicBytes(empty)).toBe(false);
        });
    });
});
