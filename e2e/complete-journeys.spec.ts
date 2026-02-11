import { test, expect } from '@playwright/test';
import { buildMockLicitacion, mockLicitacionesList, setupAuthMock } from './test-utils';

test.describe('Complete User Journey - CI Stable', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthMock(page);
        await mockLicitacionesList(page, [buildMockLicitacion()]);
    });

    test('Full flow shell: Home → History → Analytics renders without crash', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/Analista de Pliegos|Licitación/i);
        await expect(page.locator('#root')).not.toBeEmpty();

        await page.getByTitle('Historial').click();
        await expect(page.getByRole('main')).toBeVisible();

        await page.getByTitle('Analytics').click();
        await expect(page.getByText(/Analytics Dashboard|No hay datos de analytics/i)).toBeVisible();
    });

    test('History flow: renders search/filter entry points', async ({ page }) => {
        await page.goto('/history');

        const historyMain = page.getByRole('main');
        await expect(historyMain).toBeVisible();

        const searchInput = page
            .getByRole('searchbox')
            .or(page.getByPlaceholder(/buscar/i).first());

        await expect(searchInput).toBeVisible({ timeout: 10000 });
    });

    test('Auth action control is visible in shell', async ({ page }) => {
        await page.goto('/');

        const userControl = page
            .getByRole('button', { name: /iniciar sesión|cerrar sesión|user|perfil/i })
            .first();

        await expect(userControl).toBeVisible();
    });

    test('Handles 404 route by redirecting to app shell', async ({ page }) => {
        await page.goto('/non-existent-route');
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveURL(/\/$/);
        await expect(page.locator('#root')).not.toBeEmpty();
    });

    test('Offline toggle does not crash rendered app shell', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#root')).not.toBeEmpty();

        await page.context().setOffline(true);
        await expect(page.getByRole('main')).toBeVisible();
        await page.context().setOffline(false);
    });
});
