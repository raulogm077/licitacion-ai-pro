import { test, expect } from '@playwright/test';
import { setupAuthMock } from './test-utils';

test.describe('Licitación AI Pro - E2E', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthMock(page);
    });
    test('should load the home page and display correct title', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/Analista de Pliegos|Licitación/i);
        // Expect at least one heading with this name to be visible (e.g. Sidebar or Main)
        // using .first() resolves the strict mode violation
        await expect(page.getByText('Analista de Pliegos').first()).toBeVisible();
    });

    test('should navigate to History view', async ({ page }) => {
        await page.goto('/');
        await page.getByTitle('Historial').click();

        // Check for empty state or main title (depending on seeding)
        // Since it's clean slate:
        await expect(page.getByText('No hay historial')).toBeVisible();
    });

    test('should navigate to Analytics view', async ({ page }) => {
        await page.goto('/');
        await page.getByTitle('Analytics').click();

        await expect(page.getByText('No hay datos de analytics')).toBeVisible();
    });

    test('should have dark mode toggle working', async ({ page }) => {
        await page.goto('/');
        const html = page.locator('html');

        // Use title attribute we just added regex to match either state
        const toggleBtn = page.getByTitle(/modo/i);
        await expect(toggleBtn).toBeVisible();

        const initialClass = await html.getAttribute('class');
        await toggleBtn.click();

        // Wait for class change
        await page.waitForTimeout(300); // Wait for transition
        const newClass = await html.getAttribute('class');

        expect(newClass).not.toBe(initialClass);
    });

    test('should show dropzone for ingestion', async ({ page }) => {
        await page.goto('/');
        // Loosen text match to be safer and match "Arrastra y suelta tu archivo"
        await expect(page.getByText(/Arrastra y suelta|Arrastra tu/i)).toBeVisible();
        await expect(page.getByText(/PDF.*Máx 20MB/i).or(page.getByText(/Seleccionar PDF/i))).toBeVisible();
    });
});
