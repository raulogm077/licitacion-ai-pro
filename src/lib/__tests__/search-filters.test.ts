import { describe, it, expect } from 'vitest';
import { applyClientFilters } from '../search-filters';
import type { DbLicitacion } from '../../types';

function item(overrides: {
    hash: string;
    presupuesto?: unknown;
    estado?: string;
    cliente?: string;
    timestamp?: number;
    tags?: string[];
}): DbLicitacion {
    return {
        hash: overrides.hash,
        fileName: `${overrides.hash}.pdf`,
        timestamp: overrides.timestamp ?? 1000,
        data: {
            datosGenerales: { presupuesto: overrides.presupuesto },
            metadata: {
                estado: overrides.estado,
                cliente: overrides.cliente,
                tags: overrides.tags,
            },
        },
        metadata: {},
    } as unknown as DbLicitacion;
}

describe('applyClientFilters', () => {
    it('returns items untouched when no filters are set', () => {
        const items = [item({ hash: 'a' }), item({ hash: 'b' })];
        expect(applyClientFilters(items, {})).toEqual(items);
        expect(applyClientFilters(items, { tags: [] })).toEqual(items);
    });

    it('filters by budget range, unwrapping TrackedField values', () => {
        const items = [
            item({ hash: 'low', presupuesto: { value: 1000, status: 'EXTRAIDO' } }),
            item({ hash: 'mid', presupuesto: 5000 }),
            item({ hash: 'high', presupuesto: 20000 }),
            item({ hash: 'none' }),
        ];
        const result = applyClientFilters(items, { presupuestoMin: 2000, presupuestoMax: 10000 });
        expect(result.map((i) => i.hash)).toEqual(['mid']);
    });

    it('filters by estado, cliente substring (case-insensitive) and date range', () => {
        const items = [
            item({ hash: 'a', estado: 'PENDIENTE', cliente: 'Ayuntamiento de Madrid', timestamp: 500 }),
            item({ hash: 'b', estado: 'PENDIENTE', cliente: 'Diputación', timestamp: 1500 }),
            item({ hash: 'c', estado: 'DESCARTADA', cliente: 'ayuntamiento de sevilla', timestamp: 1500 }),
        ];
        expect(applyClientFilters(items, { estado: 'PENDIENTE' }).map((i) => i.hash)).toEqual(['a', 'b']);
        expect(applyClientFilters(items, { cliente: 'ayuntamiento' }).map((i) => i.hash)).toEqual(['a', 'c']);
        expect(applyClientFilters(items, { fechaDesde: 1000 }).map((i) => i.hash)).toEqual(['b', 'c']);
        expect(applyClientFilters(items, { fechaHasta: 1000 }).map((i) => i.hash)).toEqual(['a']);
    });

    it('filters by tags with OR semantics (any tag matches)', () => {
        const items = [
            item({ hash: 'a', tags: ['obras'] }),
            item({ hash: 'b', tags: ['servicios', 'limpieza'] }),
            item({ hash: 'c' }),
        ];
        expect(applyClientFilters(items, { tags: ['limpieza', 'obras'] }).map((i) => i.hash)).toEqual(['a', 'b']);
    });
});
