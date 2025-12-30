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

        // Check for error boundary first
        const errorBoundary = page.getByText(/Algo ha salido mal/i);
        if (await errorBoundary.isVisible()) {
            console.error('ERROR BOUNDARY TRIGGERED');
            const errorText = await page.evaluate(() => document.body.innerText);
            console.error(errorText);
            throw new Error('Dashboard crashed');
        }

        // Wait for ANY dashboard content - specific to Dashboard view
        await expect(page.getByText('Resumen')).toBeVisible({ timeout: 15000 });

        // Debug: Log all buttons found
        const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.innerText));
        console.log('Buttons on page:', buttons);

        // Check for Export button
        // Wait for network idle to ensure all chunks (like exceljs) are loaded
        await page.waitForLoadState('networkidle');

        // Open the actions menu first
        await page.getByTestId('actions-menu-trigger').click();

        const exportBtn = page.getByTestId('export-excel-btn');
        await expect(exportBtn).toBeVisible({ timeout: 15000 });
        await exportBtn.click();

        // Check for PDF option - Open menu again
        await page.getByTestId('actions-menu-trigger').click();
        const pdfExportBtn = page.getByTestId('export-pdf-btn');
        await expect(pdfExportBtn).toBeVisible({ timeout: 15000 });
    });

    test('should show Excel export option in Analytics', async ({ page }) => {
        await page.goto('/analytics');
        // Analytics might presumably have its own buttons, but assuming dashboard test logic was copied or similar
        // actually this test says 'in Analytics'. Analytics page might be different.
        // But assuming the error was about Dashboard export test.
        // Let's leave Analytics test alone if it uses 'Exportar Datos' button which might still exist in Analytics view.
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
