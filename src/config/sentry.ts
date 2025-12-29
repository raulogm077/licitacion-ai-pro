import * as Sentry from '@sentry/react';

// Sentry configuration
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.MODE || 'development';

export function initSentry() {
    // Only initialize in production or staging
    if (ENVIRONMENT === 'production' || ENVIRONMENT === 'staging') {
        if (!SENTRY_DSN) {
            console.warn('⚠️ Sentry DSN not configured. Error tracking disabled.');
            return;
        }

        Sentry.init({
            dsn: SENTRY_DSN,
            environment: ENVIRONMENT,

            // Performance Monitoring
            integrations: [
                Sentry.browserTracingIntegration(),
            ],

            // Set tracesSampleRate to 1.0 in staging, 0.1 in production
            tracesSampleRate: ENVIRONMENT === 'staging' ? 1.0 : 0.1,

            // Session Replay (optional - can be resource-intensive)
            replaysSessionSampleRate: 0.1,
            replaysOnErrorSampleRate: 1.0,

            // Ignore common non-critical errors
            ignoreErrors: [
                'ResizeObserver loop limit exceeded',
                'Non-Error promise rejection captured',
                // Add more as needed
            ],

            // Filter sensitive data
            beforeSend(event) {
                // Remove sensitive data from breadcrumbs/context
                if (event.request?.headers) {
                    delete event.request.headers['Authorization'];
                }

                return event;
            },
        });

        console.log(`✅ Sentry initialized (${ENVIRONMENT})`);
    }
}

// Helper to capture custom events
export function captureAnalyticsEvent(
    eventName: string,
    data?: Record<string, unknown>
) {
    Sentry.addBreadcrumb({
        category: 'analytics',
        message: eventName,
        level: 'info',
        data,
    });
}

// Export for use in logger.ts
export { Sentry };
