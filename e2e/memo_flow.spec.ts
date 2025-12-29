import { test, expect } from '@playwright/test';
import path from 'path';

test('Memo P2 Full Flow: Upload and Analyze', async ({ page }) => {
    // 1. Mock Authentication (Store State)
    // We inject a valid session into localStorage to bypass Magic Link email check
    await page.addInitScript(() => {
        window.localStorage.setItem('sb-qsohtrvnlimymwdxiokm-auth-token', JSON.stringify({
            access_token: "mock-token",
            refresh_token: "mock-refresh",
            expires_at: 9999999999,
            expires_in: 3600,
            token_type: "bearer",
            user: {
                id: "test-user-id",
                aud: "authenticated",
                role: "authenticated",
                email: "test@example.com",
            }
        }));
    });

    // 2. Go to Dashboard (Protected Route)
    await page.goto('/');

    // Verify we are logged in (Dashboard visible)
    await expect(page.getByText(/Historial/i)).toBeVisible({ timeout: 10000 });

    // 3. Upload File
    // Input type='file' usually hidden, use locator to set input files
    // Wait for the container or button that triggers the upload to be visible first
    await expect(page.getByText(/Subir/i).or(page.getByText(/Arrastra/i))).toBeVisible({ timeout: 20000 });

    // Ensure the input exists in the DOM
    const fileInput = page.locator('input[type="file"]');
    await fileInput.waitFor({ state: 'attached', timeout: 20000 });

    await fileInput.setInputFiles(path.resolve('memo_p2.pdf'));

    // 4. Verify Analysis Starts
    // Check for progress indicator or status change
    await expect(page.getByRole('heading', { name: /Analizando/i })).toBeVisible({ timeout: 10000 });

    // 5. Wait for key section (optional, depending on speed)
    // await expect(page.getByText(/Datos Generales/i)).toBeVisible({ timeout: 30000 });
});
