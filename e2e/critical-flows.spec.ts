import { test, expect } from '@playwright/test';
import { mockLicitacionesList, setupAuthMock } from './test-utils';

test.describe('Critical User Flows - CI Stable', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthMock(page);
        await mockLicitacionesList(page, []);
    });

    test('App shell loads and navigation controls are accessible', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/Analista de Pliegos|Licitación/i);

        await expect(page.getByTitle('Historial')).toBeVisible();
        await expect(page.getByTitle('Analytics')).toBeVisible();
        await expect(page.getByTitle('Búsqueda')).toBeVisible();
    });

    test('History page renders even with empty dataset', async ({ page }) => {
        await page.goto('/history');
        await expect(page.getByRole('main')).toBeVisible();

        await expect(
            page.getByText(/No hay historial|Historial de Análisis/i).first()
        ).toBeVisible({ timeout: 10000 });
    });

    test('Analytics page renders empty state safely', async ({ page }) => {
        await page.goto('/analytics');
        await expect(page.getByRole('main')).toBeVisible();
        await expect(page.getByText(/No hay datos de analytics|Analytics Dashboard/i)).toBeVisible();
    });

    test('Initial load has no unhandled page errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        expect(errors).toHaveLength(0);
    });
});
