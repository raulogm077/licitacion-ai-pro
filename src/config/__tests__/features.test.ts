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
        it('should return true when a feature flag is truthy', () => {
            const originalValue = features.enablePDFUpload;
            features.enablePDFUpload = true;
            expect(isEnabled('enablePDFUpload')).toBe(true);
            features.enablePDFUpload = originalValue;
        });

        it('should return false when a feature flag is falsy', () => {
            const originalValue = features.enablePDFUpload;
            features.enablePDFUpload = false;
            expect(isEnabled('enablePDFUpload')).toBe(false);
            features.enablePDFUpload = originalValue;
        });

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
        it('should return the exact value of the feature flag', () => {
            const originalUploadSize = features.maxUploadSizeMB;
            features.maxUploadSizeMB = 42;
            expect(getFeature('maxUploadSizeMB')).toBe(42);
            features.maxUploadSizeMB = originalUploadSize;

            const originalServerFiltering = features.enableServerSideFiltering;
            features.enableServerSideFiltering = true;
            expect(getFeature('enableServerSideFiltering')).toBe(true);
            features.enableServerSideFiltering = originalServerFiltering;
        });

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
