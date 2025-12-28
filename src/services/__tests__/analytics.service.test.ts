import { describe, it, expect } from 'vitest';
import { AnalyticsService } from '../analytics.service';

describe('AnalyticsService', () => {
    describe('calculateAnalytics', () => {
        const mockItem = (base: number) => ({
            hash: 'h' + base,
            fileName: 'f' + base,
            timestamp: 1000 * base,
            data: {
                datosGenerales: { presupuesto: 1000 * base },
                restriccionesYRiesgos: {
                    riesgos: base % 2 === 0 ? [{ descripcion: 'r', impacto: 'ALTO' as const }] : []
                },
                metadata: {
                    cliente: 'Client ' + (base % 2),
                    tags: ['tag' + (base % 3)],
                    importeAdjudicado: 500 * base
                }
            }
        } as any);

        it('returns zeros for empty input', () => {
            const result = AnalyticsService.calculateAnalytics([]);
            expect(result.totalLicitaciones).toBe(0);
            expect(result.presupuestoTotal).toBe(0);
        });

        it('calculates totals correctly', () => {
            const items = [mockItem(1), mockItem(2)];
            const result = AnalyticsService.calculateAnalytics(items);

            expect(result.totalLicitaciones).toBe(2);
            expect(result.presupuestoTotal).toBe(3000); // 1000 + 2000
            expect(result.presupuestoPromedio).toBe(1500);
            expect(result.importeAdjudicadoTotal).toBe(1500); // 500 + 1000
        });

        it('calculates time average correctly', () => {
            const items = [mockItem(1), mockItem(3)]; // timestamps 1000 and 3000
            const result = AnalyticsService.calculateAnalytics(items);
            // Difference 2000ms, divided by 2 items = 1000ms
            expect(result.tiempoAnalisisPromedio).toBe(1000);
        });

        it('aggregates risks correctly', () => {
            const items = [mockItem(2), mockItem(4)]; // Both have ALTO risk
            const result = AnalyticsService.calculateAnalytics(items);
            expect(result.distribucionRiesgos['ALTO']).toBe(2);
        });

        it('aggregates clients correctly', () => {
            const items = [mockItem(1), mockItem(2), mockItem(3)];
            // Client 1 (base 1, 3) -> Total 1000+3000=4000. Count 2.
            // Client 0 (base 2) -> Total 2000. Count 1.

            const result = AnalyticsService.calculateAnalytics(items);
            expect(result.topClientes[0].cliente).toBe('Client 1');
            expect(result.topClientes[0].total).toBe(4000);
            expect(result.topClientes[1].cliente).toBe('Client 0');
        });
    });

    describe('formatting helpers', () => {
        it('formats currency EUR', () => {
            // Check based on locale (might vary in CI, but usually comma/dot)
            // Just check it contains symbol or basic format part
            const result = AnalyticsService.formatCurrency(1000);
            expect(result).toMatch(/1.?000/);
            expect(result).toMatch(/€|EUR/);
        });

        it('formats duration', () => {
            expect(AnalyticsService.formatDuration(3600000)).toBe('1h 0m');
            expect(AnalyticsService.formatDuration(90000000)).toBe('1d 1h'); // 25h
            expect(AnalyticsService.formatDuration(60000)).toBe('1m');
        });
    });
});
