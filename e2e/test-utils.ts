import { Page } from '@playwright/test';

export async function setupAuthMock(page: Page) {
    // Mock Supabase Auth API
    await page.route(url => url.href.includes('/auth/v1/user'), async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'test-user', email: 'test@example.com' })
        });
    });

    await page.route(url => url.href.includes('/auth/v1/session'), async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ access_token: 'mock-token', user: { id: 'test-user' } })
        });
    });

    // Mock Supabase session in localStorage
    await page.addInitScript(() => {
        const token = JSON.stringify({
            access_token: 'mock-token',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'mock-refresh',
            user: { id: 'test-user', email: 'test@example.com' },
            expires_at: Math.floor(Date.now() / 1000) + 3600
        });
        window.localStorage.setItem('sb-qsohtrvnlimymwdxiokm-auth-token', token);
    });
}

/**
 * WHY: E2E tests must be deterministic in CI; this route mock prevents flaky
 * dependencies on remote Supabase data state.
 */
export async function mockLicitacionesList(page: Page, items: unknown[] = []) {
    await page.route(url => url.href.includes('/rest/v1/licitaciones'), async route => {
        const method = route.request().method();

        if (method === 'HEAD') {
            await route.fulfill({
                status: 200,
                headers: { 'content-range': `0-0/${items.length}` }
            });
            return;
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(items)
        });
    });
}

export function buildMockLicitacion(overrides: Record<string, unknown> = {}) {
    const base = {
        hash: 'test-hash',
        file_name: 'test-document.pdf',
        updated_at: new Date().toISOString(),
        data: {
            datosGenerales: {
                titulo: 'Licitación de Prueba E2E',
                presupuesto: 50000,
                moneda: 'EUR',
                cpv: ['72000000-5'],
                organoContratacion: 'Ayuntamiento de Madrid',
                plazoEjecucionMeses: 12
            },
            metadata: { estado: 'PENDIENTE', tags: ['prueba', 'e2e'] },
            criteriosAdjudicacion: {
                subjetivos: [{ descripcion: 'Criterio 1', ponderacion: 20 }],
                objetivos: [{ descripcion: 'Criterio 2', ponderacion: 80 }]
            },
            requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 100000 }, tecnica: [] },
            requisitosTecnicos: { funcionales: [], normativa: [] },
            restriccionesYRiesgos: { riesgos: [], killCriteria: [], penalizaciones: [] },
            modeloServicio: { sla: [], equipoMinimo: [] }
        }
    };

    return { ...base, ...overrides };
}
