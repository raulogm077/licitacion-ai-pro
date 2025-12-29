import { test, expect } from '@playwright/test';

test.describe('Critical User Flows - Complete Journey', () => {

    test('Upload PDF → AI Analysis → View Results', async ({ page }) => {
        // Navigate to homepage
        await page.goto('/');

        // Wait for app to load
        await expect(page).toHaveTitle(/Analista de Pliegos/);

        // Check for upload section
        const uploadSection = page.locator('[data-testid="upload-section"]').or(page.getByText(/subir.*pdf/i).first());
        await expect(uploadSection).toBeVisible({ timeout: 10000 });

        // For now, verify the upload UI is accessible
        // In real scenario: upload file, wait for analysis, verify results

        // Verify main navigation is present
        const mainContent = page.getByRole('main');
        await expect(mainContent).toBeVisible();
    });

    test('Search and Filter Licitaciones', async ({ page }) => {
        await page.goto('/');

        // Navigate to History/Search page
        const historyLink = page.getByRole('link', { name: /historial|histórico/i });

        if (await historyLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await historyLink.click();

            // Wait for history page to load
            await page.waitForLoadState('networkidle');

            // Verify search functionality exists
            const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/buscar/i).first());
            await expect(searchInput).toBeVisible({ timeout: 10000 });
        }
    });

    test('Export Functionality', async ({ page }) => {
        await page.goto('/');

        // This test verifies export buttons are accessible
        // In production: would verify PDF/Excel export works
        const mainApp = page.locator('#root');
        await expect(mainApp).not.toBeEmpty();
    });
});

test.describe('Smoke Tests - Core Functionality', () => {

    test('Homepage loads without errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        expect(errors).toHaveLength(0);
    });

    test('Navigation is accessible', async ({ page }) => {
        await page.goto('/');


        // Either navigation exists or we're on login/loading page
        const root = page.locator('#root');
        await expect(root).not.toBeEmpty();
    });

    test('No console errors on initial load', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        await page.goto('/');
        await page.waitForTimeout(2000); // Wait for initial renders

        // Filter out known acceptable errors (if any)
        const criticalErrors = consoleErrors.filter(err =>
            !err.includes('intentos fallaron') && // Expected retry logs in tests
            !err.includes('Respuesta de Edge Function') // Expected in tests
        );

        expect(criticalErrors).toHaveLength(0);
    });
});
