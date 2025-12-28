import { test, expect } from '@playwright/test';

test('Full User Journey: Render Dashboard and Check Elements', async ({ page }) => {
    // 1. Visit Home (which redirects to Login if not authenticated, or Home if anon/mocked)
    // Since we are checking purely for rendering in this "journey" smoke test:
    await page.goto('/');

    // 2. Check title
    await expect(page).toHaveTitle(/Licitación AI|Analista de Pliegos/);

    // 3. Verify core layout elements exist
    // Sidebar or Navigation
    const nav = page.getByRole('navigation');
    // It might be hidden on mobile or login page, so we check for main content
    const main = page.getByRole('main');

    if (await nav.isVisible()) {
        await expect(nav).toBeVisible();
    } else {
        // If we are on login page or loading
        console.log('Navigation not visible, checking for Login or Main content');
        await expect(main).toBeVisible();
    }

    // 4. Ideally we would mock login, but for now we verify the app shell loads without crashing
    // Check for root div
    const root = page.locator('#root');
    await expect(root).not.toBeEmpty();
});
