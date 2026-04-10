import { test, expect } from '@playwright/test';

test.describe('Authentication Wall', () => {
    test('should show lock screen for unauthenticated users', async ({ page }) => {
        // 1. Visit homepage
        await page.goto('/');

        // 2. Expect Title
        await expect(page).toHaveTitle(/Analista de Pliegos/);

        // 3. Expect "Acceso Requerido" message (from t('auth.required_title'))
        await expect(page.getByText('Acceso Requerido')).toBeVisible();

        // 4. Expect login button — UploadStep renders "Iniciar Sesión" (hardcoded)
        const lockButton = page.getByRole('button', { name: /Iniciar Sesión/i }).first();
        await expect(lockButton).toBeVisible();
    });

    test('should open auth modal when clicking login', async ({ page }) => {
        await page.goto('/');

        // Click login button (UploadStep unauthenticated state)
        await page
            .getByRole('button', { name: /Iniciar Sesión/i })
            .first()
            .click();

        // AuthModal opens in login mode — title is "Iniciar Sesión", email field is visible
        await expect(page.getByRole('heading', { name: 'Iniciar Sesión' })).toBeVisible();
        await expect(page.getByPlaceholder('tu@email.com')).toBeVisible();
    });
});
