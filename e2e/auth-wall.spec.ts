import { test, expect } from '@playwright/test';

test.describe('Authentication Wall', () => {
    test('should show the branded landing for unauthenticated users', async ({ page }) => {
        // 1. Visit homepage
        await page.goto('/');

        // 2. Expect Title
        await expect(page).toHaveTitle(/Analista de Pliegos/);

        // 3. Expect the landing hero headline
        await expect(page.getByText('Entiende cualquier pliego')).toBeVisible();

        // 4. Expect the primary CTA
        const ctaButton = page.getByRole('button', { name: /Comenzar ahora/i });
        await expect(ctaButton).toBeVisible();
    });

    test('should open auth modal when clicking the landing CTA', async ({ page }) => {
        await page.goto('/');

        await page.getByRole('button', { name: /Comenzar ahora/i }).click();

        // AuthModal opens in login mode — title is "Iniciar Sesión", email field is visible
        await expect(page.getByRole('heading', { name: 'Iniciar Sesión' })).toBeVisible();
        await expect(page.getByPlaceholder('tu@email.com')).toBeVisible();
    });
});
