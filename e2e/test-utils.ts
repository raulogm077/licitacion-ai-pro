import { Page } from '@playwright/test';

function getSupabaseRef(): string {
    const url = process.env.VITE_SUPABASE_URL || '';
    try {
        return new URL(url).hostname.split('.')[0];
    } catch {
        return 'qsohtrvnlimymwdxiokm';
    }
}

export async function setupAuthMock(page: Page) {
    const ref = getSupabaseRef();
    const authKey = `sb-${ref}-auth-token`;

    // Block external analytics/telemetry calls that would prevent networkidle in CI.
    // @vercel/analytics and @vercel/speed-insights beacon to external domains.
    await page.route(
        (url) =>
            url.hostname.includes('vercel-insights.com') ||
            url.hostname.includes('vercel-scripts.com') ||
            url.hostname.includes('sentry.io') ||
            url.hostname.includes('segment.io'),
        (route) => route.abort()
    );

    await page.route(
        (url) => url.href.includes('/auth/v1/user'),
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ id: 'test-user', email: 'test@example.com' }),
            });
        }
    );

    await page.route(
        (url) => url.href.includes('/auth/v1/session'),
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ access_token: 'mock-token', user: { id: 'test-user' } }),
            });
        }
    );

    await page.addInitScript(
        ({ key }) => {
            window.localStorage.setItem(
                key,
                JSON.stringify({
                    access_token: 'mock-token',
                    token_type: 'bearer',
                    expires_in: 3600,
                    refresh_token: 'mock-refresh',
                    user: { id: 'test-user', email: 'test@example.com' },
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                })
            );
        },
        { key: authKey }
    );
}
