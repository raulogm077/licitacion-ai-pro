import { DbLicitacion, SearchFilters } from '../types';
import { unwrap } from './tracked-field';

/**
 * Applies SearchFilters to an in-memory list of licitaciones, mirroring the
 * semantics of DBService.advancedSearch (which pushes most filters to
 * PostgREST). Used to compose free-text FTS results with active filters:
 * text search runs server-side, filters are applied client-side on top.
 */
export function applyClientFilters(items: DbLicitacion[], filters: SearchFilters): DbLicitacion[] {
    const hasFilters = Object.values(filters).some((v) => v !== undefined && (!Array.isArray(v) || v.length > 0));
    if (!hasFilters) return items;

    return items.filter((item) => {
        const presupuesto = toNumber(unwrap(item.data.datosGenerales?.presupuesto));

        if (
            filters.presupuestoMin !== undefined &&
            !(presupuesto !== undefined && presupuesto >= filters.presupuestoMin)
        ) {
            return false;
        }
        if (
            filters.presupuestoMax !== undefined &&
            !(presupuesto !== undefined && presupuesto <= filters.presupuestoMax)
        ) {
            return false;
        }
        if (filters.estado && item.data.metadata?.estado !== filters.estado) {
            return false;
        }
        if (filters.cliente) {
            const cliente = item.data.metadata?.cliente ?? '';
            if (!cliente.toLowerCase().includes(filters.cliente.toLowerCase())) return false;
        }
        if (filters.fechaDesde !== undefined && item.timestamp < filters.fechaDesde) {
            return false;
        }
        if (filters.fechaHasta !== undefined && item.timestamp > filters.fechaHasta) {
            return false;
        }
        if (filters.tags && filters.tags.length > 0) {
            const tags = item.data.metadata?.tags ?? [];
            if (!tags.some((tag) => filters.tags!.includes(tag))) return false;
        }
        return true;
    });
}

function toNumber(value: unknown): number | undefined {
    const num = typeof value === 'string' ? Number(value) : value;
    return typeof num === 'number' && Number.isFinite(num) ? num : undefined;
}
