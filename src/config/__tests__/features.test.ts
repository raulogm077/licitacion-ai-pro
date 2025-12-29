import { describe, it, expect } from 'vitest';
import { features, isEnabled, getFeature } from '../features';

describe('Feature Flags', () => {
    it('should have all required flags defined', () => {
        expect(features.enablePDFUpload).toBeDefined();
        expect(features.enableAIAnalysis).toBeDefined();
        expect(features.enableExport).toBeDefined();
        expect(features.enableSentry).toBeDefined();
        expect(features.enableAnalytics).toBeDefined();
    });

    it('should enable core features by default', () => {
        expect(features.enablePDFUpload).toBe(true);
        expect(features.enableAIAnalysis).toBe(true);
        expect(features.enableExport).toBe(true);
    });

    it('should have sensible limits', () => {
        expect(features.maxUploadSizeMB).toBeGreaterThan(0);
        expect(features.maxUploadSizeMB).toBeLessThanOrEqual(100);
        expect(features.maxConcurrentAnalyses).toBeGreaterThan(0);
    });

    describe('isEnabled helper', () => {
        it('should return boolean for feature flags', () => {
            const result = isEnabled('enablePDFUpload');
            expect(typeof result).toBe('boolean');
        });

        it('should work with all flag types', () => {
            expect(isEnabled('enableDevTools')).toBeDefined();
            expect(isEnabled('enableSentry')).toBeDefined();
        });
    });

    describe('getFeature helper', () => {
        it('should return feature value', () => {
            const maxUpload = getFeature('maxUploadSizeMB');
            expect(typeof maxUpload).toBe('number');
            expect(maxUpload).toBeGreaterThan(0);
        });

        it('should return correct types', () => {
            const boolValue = getFeature('enablePDFUpload');
            const numValue = getFeature('maxUploadSizeMB');

            expect(typeof boolValue).toBe('boolean');
            expect(typeof numValue).toBe('number');
        });
    });

    describe('Environment-based configuration', () => {
        it('enables dev tools only in development', () => {
            const isDev = import.meta.env.MODE === 'development';
            expect(features.enableDevTools).toBe(isDev);
            expect(features.enableDebugLogs).toBe(isDev);
        });

        it('has higher limits in non-production', () => {
            const isProd = import.meta.env.MODE === 'production';
            if (isProd) {
                expect(features.maxUploadSizeMB).toBeLessThanOrEqual(10);
            } else {
                expect(features.maxUploadSizeMB).toBeGreaterThanOrEqual(10);
            }
        });
    });
});
