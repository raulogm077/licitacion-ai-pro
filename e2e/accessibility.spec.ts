import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupAuthMock } from './test-utils';

test.describe('Accessibility - WCAG Compliance', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthMock(page);
    });

    test('home page has no critical accessibility violations', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
        if (critical.length > 0) {
            console.log('Accessibility violations:', JSON.stringify(critical, null, 2));
        }
        expect(critical).toHaveLength(0);
    });

    test('history page has no critical accessibility violations', async ({ page }) => {
        await page.goto('/history');
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
        expect(critical).toHaveLength(0);
    });

    test('templates page has no critical accessibility violations', async ({ page }) => {
        await page.goto('/templates');
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
        expect(critical).toHaveLength(0);
    });
});
