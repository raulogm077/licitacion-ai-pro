import { test, expect } from '@playwright/test';

test('debug', async ({ page }) => {
    await page.goto('http://localhost:4173/');
    await page.waitForTimeout(2000);
});
