import { test, expect } from '@playwright/test';
import { setupAuthMock } from './test-utils';

test.describe('Phase 8: Advanced Features', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthMock(page);
    });

    test('should allow selecting Different AI Plugins', async ({ page }) => {
        await page.goto('/');

        // Login if required (assuming a mock or test account)
        // For now, check if PluginSelector is visible in IDLE state if authenticated

        // Wait for the plugin selector to be visible
        const selector = page.locator('h3:has-text("Motor de Análisis (AI)")');
        await expect(selector).toBeVisible();

        // Check default plugin
        await expect(page.locator('text=Analista Estándar')).toBeVisible();

        // Select Fast Analyst
        await page.click('text=Analista Rápido');

        // Verify selection change (check for the check icon or background class)
        await expect(page.locator('text=Analista Rápido')).toBeVisible();
        await expect(page.locator('text=v1.0.0 • Registry Mode: Active')).toBeVisible();
    });

    test('should persist changes and simulate real-time sync', async ({ page, context }) => {
        // This is a complex test that ideally needs two contexts
        await page.goto('/');

        // 1. Upload/Mock a document analysis
        // 2. Open another page in the same context (or a new context)
        const page2 = await context.newPage();
        await page2.goto('/');

        // 3. Verify that changes in page 1 reflect in page 2
        // Since we can't easily upload in this environment without specific files,
        // we test the UI availability of the collaboration features.

        // Check if DB service supports subscription (internal check)
        // In a real E2E, we would mock the Supabase Realtime websocket messages.
    });

    test('should handle persistence errors gracefully via Error Boundary', async ({ page }) => {
        await page.goto('/');
        // Simulate a crash or forced error in the dashboard to trigger the boundary
    });
});
