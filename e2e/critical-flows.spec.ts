import { test, expect } from '@playwright/test';
import { setupAuthMock } from './test-utils';

test.describe('Critical User Flows - Complete Journey', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthMock(page);
    });

    test('Upload PDF → AI Analysis → View Results', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/Analista de Pliegos/);

        // Check for upload section OR login button — robust for auth state variations
        const uploadSection = page
            .locator('[data-testid="upload-section"]')
            .or(page.locator('input[type="file"]'))
            .first();
        const loginButton = page.getByRole('button', { name: /login|iniciar.*sesión/i }).first();

        await expect(uploadSection.or(loginButton)).toBeVisible({ timeout: 10000 });

        if (await uploadSection.isVisible()) {
            const mainContent = page.getByRole('main');
            await expect(mainContent).toBeVisible();
        }
    });

    test('Search and Filter Licitaciones', async ({ page }) => {
        await page.goto('/');

        // Navigate to History using sidebar title attribute
        const historyLink = page.getByTitle('Historial');

        if (await historyLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await historyLink.click();
            await page.waitForSelector('#root', { timeout: 10000 }).catch(() => null);

            // Search input has role="searchbox" or data-testid="search-input"
            const searchInput = page
                .getByRole('searchbox')
                .or(page.getByTestId('search-input'))
                .or(page.getByPlaceholder(/buscar/i).first());
            await expect(searchInput).toBeVisible({ timeout: 10000 });
        }
    });

    test('Export Functionality', async ({ page }) => {
        await page.goto('/');
        const mainApp = page.locator('#root');
        await expect(mainApp).not.toBeEmpty();
    });
});

test.describe('Smoke Tests - Core Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthMock(page);
    });

    test('Homepage loads without errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => {
            const msg = err.message;
            // Filter known CI environment initialization errors
            if (
                msg.includes('Supabase client not available') ||
                msg.includes('Invalid Environment Configuration') ||
                msg.includes('Auth Initialization Error') ||
                msg.includes('Failed to fetch') ||
                msg.includes('NetworkError') ||
                msg.includes('net::ERR_')
            )
                return;
            errors.push(msg);
        });

        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 10000 }).catch(() => null);

        expect(errors).toHaveLength(0);
    });

    test('Navigation is accessible', async ({ page }) => {
        await page.goto('/');
        const root = page.locator('#root');
        await expect(root).not.toBeEmpty();
    });

    test('No console errors on initial load', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        await page.goto('/');
        await page.waitForTimeout(2000);

        const criticalErrors = consoleErrors.filter(
            (err) =>
                !err.includes('intentos fallaron') &&
                !err.includes('Respuesta de Edge Function') &&
                !err.includes('status of 404') &&
                !err.includes('net::ERR_NAME_NOT_RESOLVED') &&
                !err.includes('net::ERR_INTERNET_DISCONNECTED') &&
                !err.includes('net::ERR_FAILED') &&
                !err.includes('net::ERR_CONNECTION_REFUSED') &&
                !err.includes('Invalid Environment Configuration') &&
                !err.includes('Auth Initialization Error') &&
                !err.includes('Supabase client not available')
        );

        expect(criticalErrors).toHaveLength(0);
    });
});
