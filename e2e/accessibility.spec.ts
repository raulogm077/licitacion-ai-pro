import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupAuthMock } from './test-utils';

test.describe('Accessibility - WCAG Compliance', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthMock(page);
    });

    test('home page has no critical accessibility violations', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 10000 }).catch(() => null);

        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

        // Log all violations for visibility (critical + serious)
        const seriousOrCritical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
        if (seriousOrCritical.length > 0) {
            console.log(
                `⚠️  ${seriousOrCritical.length} WCAG violation(s) on /:`,
                seriousOrCritical.map((v) => `${v.id} (${v.impact}): ${v.description}`).join('\n')
            );
        }

        // Block pipeline on CRITICAL violations only — serious violations tracked separately
        const critical = results.violations.filter((v) => v.impact === 'critical');
        expect(
            critical,
            `Critical WCAG violations on /:\n${critical.map((v) => `  ${v.id}: ${v.description}`).join('\n')}`
        ).toHaveLength(0);
    });

    test('history page has no critical accessibility violations', async ({ page }) => {
        await page.goto('/history');
        await page.waitForSelector('#root', { timeout: 10000 }).catch(() => null);

        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

        const seriousOrCritical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
        if (seriousOrCritical.length > 0) {
            console.log(
                `⚠️  ${seriousOrCritical.length} WCAG violation(s) on /history:`,
                seriousOrCritical.map((v) => `${v.id} (${v.impact}): ${v.description}`).join('\n')
            );
        }

        const critical = results.violations.filter((v) => v.impact === 'critical');
        expect(
            critical,
            `Critical WCAG violations on /history:\n${critical.map((v) => `  ${v.id}: ${v.description}`).join('\n')}`
        ).toHaveLength(0);
    });

    test('templates page has no critical accessibility violations', async ({ page }) => {
        await page.goto('/templates');
        await page.waitForSelector('#root', { timeout: 10000 }).catch(() => null);

        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

        const seriousOrCritical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
        if (seriousOrCritical.length > 0) {
            console.log(
                `⚠️  ${seriousOrCritical.length} WCAG violation(s) on /templates:`,
                seriousOrCritical.map((v) => `${v.id} (${v.impact}): ${v.description}`).join('\n')
            );
        }

        const critical = results.violations.filter((v) => v.impact === 'critical');
        expect(
            critical,
            `Critical WCAG violations on /templates:\n${critical.map((v) => `  ${v.id}: ${v.description}`).join('\n')}`
        ).toHaveLength(0);
    });
});
