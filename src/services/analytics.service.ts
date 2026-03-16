import { LicitacionData, AnalyticsData } from '../types';

interface LicitacionHistoryItem {
    hash: string;
    fileName: string;
    timestamp: number;
    data: LicitacionData;
}

export class AnalyticsService {
    static calculateAnalytics(items: LicitacionHistoryItem[]): AnalyticsData {
        if (items.length === 0) {
            return {
                totalLicitaciones: 0,
                presupuestoTotal: 0,
                presupuestoPromedio: 0,
                importeAdjudicadoTotal: 0,
                tiempoAnalisisPromedio: 0,
                distribucionEstados: {},
                distribucionRiesgos: {},
                topClientes: [],
                topTags: [],
                promedioCriterios: { subjetivos: 0, objetivos: 0 },
            };
        }

        const totalLicitaciones = items.length;

        // Accumulators for single-pass traversal
        let presupuestoTotal = 0;
        let importeAdjudicadoTotal = 0;
        let totalSubjetivos = 0;
        let totalObjetivos = 0;
        let minTimestamp = Infinity;
        let maxTimestamp = -Infinity;
        const distribucionEstados: Record<string, number> = {};
        const distribucionRiesgos: Record<string, number> = {};
        const clienteMap = new Map<string, { count: number; total: number }>();
        const tagMap = new Map<string, number>();

        // ⚡ Bolt Optimization: Single O(n) traversal replacing multiple array methods
        for (const item of items) {
            // Presupuestos & Importes
            presupuestoTotal += item.data.datosGenerales.presupuesto;
            importeAdjudicadoTotal += item.data.metadata?.importeAdjudicado || 0;

            // Criterios
            totalSubjetivos += item.data.criteriosAdjudicacion.subjetivos.length;
            totalObjetivos += item.data.criteriosAdjudicacion.objetivos.length;

            // Timestamps for min/max
            if (item.timestamp < minTimestamp) minTimestamp = item.timestamp;
            if (item.timestamp > maxTimestamp) maxTimestamp = item.timestamp;

            // Estados
            const estado = item.data.metadata?.estado || 'SIN_ESTADO';
            distribucionEstados[estado] = (distribucionEstados[estado] || 0) + 1;

            // Riesgos
            for (const riesgo of item.data.restriccionesYRiesgos.riesgos) {
                distribucionRiesgos[riesgo.impacto] = (distribucionRiesgos[riesgo.impacto] || 0) + 1;
            }

            // Clientes
            const cliente = item.data.metadata?.cliente;
            if (cliente) {
                const existing = clienteMap.get(cliente) || { count: 0, total: 0 };
                clienteMap.set(cliente, {
                    count: existing.count + 1,
                    total: existing.total + item.data.datosGenerales.presupuesto,
                });
            }

            // Tags
            if (item.data.metadata?.tags) {
                for (const tag of item.data.metadata.tags) {
                    tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
                }
            }
        }

        const presupuestoPromedio = presupuestoTotal / totalLicitaciones;

        // Tiempo promedio (estimado desde primera a última licitación)
        const tiempoAnalisisPromedio = totalLicitaciones > 1 && maxTimestamp >= minTimestamp
            ? (maxTimestamp - minTimestamp) / totalLicitaciones
            : 0;

        const topClientes = Array.from(clienteMap.entries())
            .map(([cliente, stats]) => ({ cliente, ...stats }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10); // Top 10

        const topTags = Array.from(tagMap.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15); // Top 15

        const promedioCriterios = {
            subjetivos: totalSubjetivos / totalLicitaciones,
            objetivos: totalObjetivos / totalLicitaciones
        };

        return {
            totalLicitaciones,
            presupuestoTotal,
            presupuestoPromedio,
            importeAdjudicadoTotal,
            tiempoAnalisisPromedio,
            distribucionEstados,
            distribucionRiesgos,
            topClientes,
            topTags,
            promedioCriterios,
        };
    }

    static formatCurrency(amount: number, currency = 'EUR'): string {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency
        }).format(amount);
    }

    static formatNumber(num: number): string {
        return new Intl.NumberFormat('es-ES').format(num);
    }

    static formatDuration(ms: number): string {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days}d ${hours % 24}h`;
        }
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }
}
