import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatPercentage, formatNumber } from '../formatters';

describe('formatters', () => {
    describe('formatCurrency', () => {
        it('formats a standard integer input with default currency (EUR)', () => {
            const result = formatCurrency(1234);
            // Non-breaking space \u00A0 or normal space \s before currency symbol
            // May or may not have thousands separator depending on Node/ICU data
            expect(result).toMatch(/1\.?234,00\s*\u00A0?€/);
        });

        it('formats a standard integer input with specified currency (USD)', () => {
            const result = formatCurrency(1234, 'USD');
            expect(result).toMatch(/1\.?234,00\s*\u00A0?(US\$|\$)/);
        });
    });

    describe('formatDate', () => {
        it('formats a Date object correctly', () => {
            const date = new Date(2024, 0, 15, 14, 30);
            const result = formatDate(date);
            expect(result).toMatch(/15\s+ene\.?,?\s+2024,\s+14:30/i);
        });

        it('formats a numeric timestamp correctly', () => {
            const timestamp = new Date(2024, 5, 20, 9, 15).getTime();
            const result = formatDate(timestamp);
            expect(result).toMatch(/20\s+jun\.?,?\s+2024,\s+09:15/i);
        });

        it('formats a valid ISO string correctly', () => {
            const date = new Date(2023, 11, 25, 18, 45);
            const result = formatDate(date.toISOString());
            expect(result).toMatch(/25\s+dic\.?,?\s+2023,\s+18:45/i);
        });

        it('throws a RangeError for an invalid date string', () => {
            expect(() => formatDate('invalid')).toThrow(RangeError);
        });

        it('throws a RangeError for NaN timestamp', () => {
            expect(() => formatDate(NaN)).toThrow(RangeError);
        });
    });

    describe('formatPercentage', () => {
        it('formats an integer with default decimals (0)', () => {
            const result = formatPercentage(50);
            expect(result).toMatch(/50\s*%/);
        });

        it('formats a decimal value with specified decimals', () => {
            const result = formatPercentage(12.345, 2);
            expect(result).toMatch(/12,35\s*%/);
        });
    });

    describe('formatNumber', () => {
        it('formats a large integer with thousands separators', () => {
            const result = formatNumber(1000000);
            expect(result).toMatch(/1\.?000\.?000/);
        });

        it('formats a decimal value with decimal separator', () => {
            const result = formatNumber(1234.56);
            expect(result).toMatch(/1\.?234,56/);
        });
    });
});
