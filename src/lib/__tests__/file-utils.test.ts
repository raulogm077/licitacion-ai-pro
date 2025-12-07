
import { describe, it, expect } from 'vitest';
import { validatePdfMagicBytes, generateFileHash } from '../file-utils';

describe('file-utils', () => {
    describe('validatePdfMagicBytes', () => {
        it('should return true for a valid PDF file', async () => {
            // Create a dummy PDF file with the correct %PDF header
            const blob = new Blob(['%PDF-1.4 content'], { type: 'application/pdf' });
            const file = new File([blob], 'test.pdf', { type: 'application/pdf' });

            const isValid = await validatePdfMagicBytes(file);
            expect(isValid).toBe(true);
        });

        it('should return false for a non-PDF file', async () => {
            // Create a dummy text file
            const blob = new Blob(['simple text content'], { type: 'text/plain' });
            const file = new File([blob], 'test.txt', { type: 'text/plain' });

            const isValid = await validatePdfMagicBytes(file);
            expect(isValid).toBe(false);
        });
    });

    describe('generateFileHash', () => {
        it('should generate a consistent SHA-256 hash', async () => {
            const blob = new Blob(['test content'], { type: 'text/plain' });
            const file = new File([blob], 'test.txt', { type: 'text/plain' });

            const hash1 = await generateFileHash(file);
            const hash2 = await generateFileHash(file);

            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA-256 hex string length
        });

        it('should generate different hashes for different content', async () => {
            const file1 = new File([new Blob(['content A'])], 'a.txt');
            const file2 = new File([new Blob(['content B'])], 'b.txt');

            const hash1 = await generateFileHash(file1);
            const hash2 = await generateFileHash(file2);

            expect(hash1).not.toBe(hash2);
        });
    });
});
