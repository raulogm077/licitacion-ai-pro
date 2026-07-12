import { describe, it, expect } from 'vitest';
import { features } from '../features';

describe('Feature Flags', () => {
    it('should have all required flags defined', () => {
        expect(features.enableSentry).toBeDefined();
        expect(features.enableAnalytics).toBeDefined();
        expect(features.enableCaching).toBeDefined();
        expect(features.enableDevTools).toBeDefined();
    });

    it('enables analytics and caching by default', () => {
        expect(features.enableAnalytics).toBe(true);
        expect(features.enableCaching).toBe(true);
    });

    describe('Environment-based configuration', () => {
        it('enables dev tools only in development', () => {
            const isDev = import.meta.env.MODE === 'development';
            expect(features.enableDevTools).toBe(isDev);
        });
    });
});
