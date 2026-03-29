// Feature flags configuration
export interface FeatureFlags {
    // Core Features - Kill switches
    enablePDFUpload: boolean;
    enableAIAnalysis: boolean;
    enableExport: boolean;

    // Experiments
    enableNewDashboardUI: boolean;
    enableAdvancedSearch: boolean;

    // Limits
    maxUploadSizeMB: number;
    maxConcurrentAnalyses: number;

    // Integrations
    enableSentry: boolean;
    enableAnalytics: boolean;

    // Performance
    enableServerSideFiltering: boolean;
    enableCaching: boolean;

    // Development
    enableDevTools: boolean;
    enableDebugLogs: boolean;
}

const getEnv = () => import.meta.env.MODE || 'development';
const isProd = () => getEnv() === 'production';
const isStaging = () => getEnv() === 'staging';
const isDev = () => getEnv() === 'development';

/**
 * Feature flags configuration
 *
 * To modify a flag:
 * 1. Update the value here for environment-based changes
 * 2. Or set VITE_FEATURE_* environment variable in Vercel
 *
 * Priority: ENV VAR > hardcoded value
 */
export const features: FeatureFlags = {
    // Core features - always enabled unless critical bug
    enablePDFUpload: getEnvFlag('VITE_FEATURE_PDF_UPLOAD', true),
    enableAIAnalysis: getEnvFlag('VITE_FEATURE_AI_ANALYSIS', true),
    enableExport: getEnvFlag('VITE_FEATURE_EXPORT', true),

    // Experiments - more conservative in production
    enableNewDashboardUI: getEnvFlag('VITE_FEATURE_NEW_DASHBOARD', !isProd()),
    enableAdvancedSearch: getEnvFlag('VITE_FEATURE_ADVANCED_SEARCH', !isProd()),

    // Limits - different per environment
    maxUploadSizeMB: getEnvNumber('VITE_MAX_UPLOAD_MB', isProd() ? 10 : 50),
    maxConcurrentAnalyses: getEnvNumber('VITE_MAX_CONCURRENT', isProd() ? 3 : 10),

    // Integrations - production/staging only
    enableSentry: getEnvFlag('VITE_FEATURE_SENTRY', isProd() || isStaging()),
    enableAnalytics: getEnvFlag('VITE_FEATURE_ANALYTICS', true),

    // Performance
    enableServerSideFiltering: getEnvFlag('VITE_FEATURE_SERVER_FILTER', false),
    enableCaching: getEnvFlag('VITE_FEATURE_CACHING', true),

    // Development helpers
    enableDevTools: getEnvFlag('VITE_FEATURE_DEV_TOOLS', isDev()),
    enableDebugLogs: getEnvFlag('VITE_FEATURE_DEBUG_LOGS', isDev()),
};

/**
 * Helper to get boolean feature flag from env var
 */
function getEnvFlag(key: string, defaultValue: boolean): boolean {
    const envValue = import.meta.env[key];
    if (envValue === undefined) return defaultValue;
    return envValue === 'true' || envValue === '1';
}

/**
 * Helper to get number from env var
 */
function getEnvNumber(key: string, defaultValue: number): number {
    const envValue = import.meta.env[key];
    if (envValue === undefined) return defaultValue;
    const parsed = parseInt(envValue, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Check if a feature is enabled
 */
export function isEnabled(flag: keyof FeatureFlags): boolean {
    return Boolean(features[flag]);
}

/**
 * Get feature value (for numbers/strings)
 */
export function getFeature<K extends keyof FeatureFlags>(flag: K): FeatureFlags[K] {
    return features[flag];
}
