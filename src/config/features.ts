// Feature flags configuration
//
// Only flags with real consumers live here. The upload size limit is NOT a
// feature flag: it is bound by the synchronous pipeline's payload/timeout
// budget and lives as MAX_PDF_SIZE_MB in src/config/constants.ts (mirrored by
// MAX_PAYLOAD_BYTES on the backend). A UI-facing 10–50MB flag would contradict
// that real limit, so it is intentionally absent here.
export interface FeatureFlags {
    // Integrations
    enableSentry: boolean;
    enableAnalytics: boolean;

    // Performance
    enableCaching: boolean;

    // Development
    enableDevTools: boolean;
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
    // Integrations - production/staging only
    enableSentry: getEnvFlag('VITE_FEATURE_SENTRY', isProd() || isStaging()),
    enableAnalytics: getEnvFlag('VITE_FEATURE_ANALYTICS', true),

    // Performance
    enableCaching: getEnvFlag('VITE_FEATURE_CACHING', true),

    // Development helpers
    enableDevTools: getEnvFlag('VITE_FEATURE_DEV_TOOLS', isDev()),
};

/**
 * Helper to get boolean feature flag from env var
 */
function getEnvFlag(key: string, defaultValue: boolean): boolean {
    const envValue = import.meta.env[key];
    if (envValue === undefined) return defaultValue;
    return envValue === 'true' || envValue === '1';
}
