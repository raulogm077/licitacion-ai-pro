import { test, expect } from '@playwright/test';

test.describe('Authentication Wall', () => {
    test('should show lock screen for unauthenticated users', async ({ page }) => {
        // 1. Visit homepage
        await page.goto('/');

        // 2. Expect Title
        await expect(page).toHaveTitle(/Analista de Pliegos/);

        // 3. Expect "Acceso Requerido" message
        await expect(page.getByText('Acceso Requerido')).toBeVisible();

        // 4. Expect Lock Icon
        const lockButton = page.getByRole('button', { name: /Iniciar Sesión para Continuar/i });
        await expect(lockButton).toBeVisible();
    });

    test('should open auth modal when clicking login', async ({ page }) => {
        await page.goto('/');

        // Click login button
        await page.getByRole('button', { name: /Iniciar Sesión para Continuar/i }).click();

        // Expect Modal
        await expect(page.getByText('Bienvenido de nuevo')).toBeVisible();
        await expect(page.getByPlaceholder('tucorreo@empresa.com')).toBeVisible();
    });
});
