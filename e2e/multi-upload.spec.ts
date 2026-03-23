import { test, expect } from '@playwright/test';

test.describe('Multi-document Upload and Analysis', () => {
    test('Should allow uploading multiple PDF files if authenticated', async ({ page }) => {
        // Intercept all supabase.co requests to mock auth and API
        await page.route('**/*.supabase.co/**', async (route) => {
            const url = route.request().url();

            const headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'Content-Type': 'application/json',
            };

            if (route.request().method() === 'OPTIONS') {
                return route.fulfill({ status: 204, headers });
            }

            if (url.includes('/auth/v1/')) {
                return route.fulfill({
                    status: 200,
                    headers,
                    body: JSON.stringify({
                        access_token: 'mock-token',
                        token_type: 'bearer',
                        expires_in: 3600,
                        refresh_token: 'mock-refresh',
                        user: {
                            id: 'mock-user-id',
                            aud: 'authenticated',
                            role: 'authenticated',
                            email: 'test@example.com',
                        },
                    }),
                });
            }

            if (url.includes('/functions/v1/analyze-with-agents')) {
                return route.fulfill({
                    status: 200,
                    headers: {
                        'Cache-Control': 'no-cache',
                        Connection: 'keep-alive',
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'text/event-stream',
                    },
                    body: `data: {"type":"status","message":"Iniciando contexto de ejecución..."}\n\ndata: {"type":"status","message":"Analizando documentos (3 archivos)..."}\n\ndata: {"type":"result","data":{"metadata":{"title":"Licitación de Prueba Multiple","object":"Servicios","budget":1000},"riesgos":[],"requisitos":[]}}\n\n`,
                });
            }

            if (url.includes('/rest/v1/')) {
                return route.fulfill({ status: 200, headers, body: '[]' });
            }

            return route.fulfill({ status: 200, headers, body: '{}' });
        });

        // Inject Supabase auth session into localStorage before navigating
        await page.goto('/');

        // Attempt to inject auth state to bypass login
        await page.evaluate(() => {
            const keys = Object.keys(localStorage);
            const authKey = keys.find((k) => k.includes('auth-token')) || 'sb-auth-token';
            localStorage.setItem(
                authKey,
                JSON.stringify({
                    access_token: 'mock-token',
                    token_type: 'bearer',
                    expires_in: 3600,
                    refresh_token: 'mock-refresh',
                    user: {
                        id: 'mock-user-id',
                        aud: 'authenticated',
                        role: 'authenticated',
                        email: 'test@example.com',
                    },
                })
            );
        });

        // Reload to pick up the injected session
        await page.reload();

        // Wait for the app to load with either upload zone or login
        const uploadHint = page.getByText(/Arrastra y suelta|Sube tu documento/i).first();
        const loginButton = page.getByRole('button', { name: /login|iniciar.*sesión/i }).first();

        await expect(uploadHint.or(loginButton)).toBeVisible({ timeout: 10000 });

        // If login button is visible, try to authenticate via UI
        if (await loginButton.isVisible()) {
            await loginButton.click();
            await page.getByPlaceholder(/tu@email.com/i).fill('test@example.com');
            await page.getByPlaceholder(/••••••••/i).fill('password123');
            await page.getByRole('button', { name: 'Iniciar Sesión' }).nth(1).click();
            await page.waitForTimeout(1000);
        }

        // Wait for the upload dropzone
        await expect(page.getByText(/Arrastra y suelta|Sube tu documento|Seleccionar Archivo/i).first()).toBeVisible({
            timeout: 8000,
        });

        const fileInput = page.locator('input[type="file"]');
        await fileInput.waitFor({ state: 'attached', timeout: 5000 });

        // Make file input interactable
        await page.evaluate(() => {
            const el = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (el) {
                el.style.display = 'block';
                el.style.visibility = 'visible';
                el.style.opacity = '1';
                el.style.width = '10px';
                el.style.height = '10px';
                el.style.position = 'absolute';
                el.style.top = '0';
                el.style.left = '0';
            }
        });

        // Upload multiple files
        await fileInput.setInputFiles([
            { name: 'pliego_principal.pdf', mimeType: 'application/pdf', buffer: Buffer.from('test1 content') },
            { name: 'anexo_tecnico.pdf', mimeType: 'application/pdf', buffer: Buffer.from('test2 content') },
            { name: 'memoria_justificativa.pdf', mimeType: 'application/pdf', buffer: Buffer.from('test3 content') },
        ]);

        // Verify that multiple files are listed
        await expect(page.getByText('pliego_principal.pdf')).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('anexo_tecnico.pdf')).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('memoria_justificativa.pdf')).toBeVisible({ timeout: 5000 });

        // Start analysis
        const startButton = page.getByRole('button', { name: /Analizar con IA/i });
        await expect(startButton).toBeVisible();

        await startButton.click();

        // Verify analyzing view is shown
        await expect(
            page
                .getByText(/Analizando documentos/i)
                .or(page.getByText(/Analizando licitación/i))
                .or(page.getByText(/Iniciando contexto de ejecución/i))
        ).toBeVisible({ timeout: 10000 });
    });
});
