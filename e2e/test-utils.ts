import { Page } from '@playwright/test';

export async function setupAuthMock(page: Page) {
    // Mock Supabase Auth API
    await page.route(url => url.href.includes('/auth/v1/user'), async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'test-user', email: 'test@example.com' })
        });
    });

    await page.route(url => url.href.includes('/auth/v1/session'), async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ access_token: 'mock-token', user: { id: 'test-user' } })
        });
    });

    // Mock Supabase session in localStorage
    await page.addInitScript(() => {
        const token = JSON.stringify({
            access_token: 'mock-token',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'mock-refresh',
            user: { id: 'test-user', email: 'test@example.com' },
            expires_at: Math.floor(Date.now() / 1000) + 3600
        });
        window.localStorage.setItem('sb-qsohtrvnlimymwdxiokm-auth-token', token);
    });
}
