import { test, expect } from '@playwright/test';
import { setupAuthMock } from './test-utils';

test.describe('Phase 9: Export Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthMock(page);

        // Mock Supabase API for licitaciones - use a more permissive pattern
        await page.route(url => url.href.includes('/rest/v1/licitaciones'), async route => {
            console.log('Fulfilling Route:', route.request().url());
            const method = route.request().method();
            if (method === 'HEAD') {
                return route.fulfill({ status: 200, headers: { 'content-range': '0-0/1' } });
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        hash: 'test-hash',
                        file_name: 'test-document.pdf',
                        updated_at: new Date().toISOString(),
                        data: {
                            datosGenerales: { titulo: 'Licitación de Prueba E2E', presupuesto: 50000, moneda: 'EUR', cpv: ['72000000-5'], organoContratacion: 'Ayuntamiento de Madrid', plazoEjecucionMeses: 12 },
                            metadata: { estado: 'PENDIENTE', tags: ['prueba', 'e2e'], sectionStatus: { datosGenerales: 'success', criteriosAdjudicacion: 'success' } },
                            criteriosAdjudicacion: { subjetivos: [{ descripcion: 'Criterio 1', ponderacion: 20 }], objetivos: [{ descripcion: 'Criterio 2', ponderacion: 80 }] },
                            requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 100000 }, tecnica: [] },
                            requisitosTecnicos: { funcionales: [], normativa: [] },
                            restriccionesYRiesgos: { riesgos: [], killCriteria: [], penalizaciones: [] },
                            modeloServicio: { sla: [], equipoMinimo: [] }
                        }
                    }
                ])
            });
        });

        await page.goto('/');
        // Wait for potential redirected login or initial load
        await expect(page).toHaveTitle(/Analista de Pliegos/);
    });

    test('should show PDF export option in Dashboard', async ({ page }) => {
        console.log('--- Starting Dashboard Export Test (Direct Injection) ---');
        await page.goto('/');

        // We use a trick: navigate to a page that will trigger a store update if possible,
        // or just rely on the history flow BUT with better waiting.
        // Actually, let's stick to the history flow but wait for the data to be in the DOM
        await page.goto('/history');
        const firstItem = page.getByText('Licitación de Prueba E2E').first();
        await expect(firstItem).toBeVisible({ timeout: 10000 });
        await firstItem.click();

        // Wait for ANY dashboard content
        await expect(page.getByText(/Licitación de Prueba E2E/i)).toBeVisible({ timeout: 15000 });

        // Debug: Log all buttons found
        const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.innerText));
        console.log('Buttons on page:', buttons);

        // Check for Export button
        // Wait for network idle to ensure all chunks (like exceljs) are loaded
        await page.waitForLoadState('networkidle');

        const exportBtn = page.getByText('Exportar', { exact: true });
        await expect(exportBtn).toBeVisible({ timeout: 15000 });
        await exportBtn.click(); // Click might be better than hover for mobile/responsiveness, but hover is in original test.
        // Let's stick to hover but ensure visibility first
        await exportBtn.hover();

        // Check for PDF option
        await expect(page.getByText('PDF (.pdf)')).toBeVisible();
    });

    test('should show Excel export option in Analytics', async ({ page }) => {
        await page.goto('/analytics');
        await expect(page.getByRole('button', { name: /Exportar Datos \(.xlsx\)/i })).toBeVisible({ timeout: 10000 });
    });

    test('should show new criteria statistics in Analytics', async ({ page }) => {
        await page.goto('/analytics');
        // Check for the new sections
        await expect(page.getByText(/Promedio de Criterios por Licitación/i)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/Criterios Subjetivos/i)).toBeVisible();
        await expect(page.getByText(/Criterios Objetivos/i)).toBeVisible();
    });
});
