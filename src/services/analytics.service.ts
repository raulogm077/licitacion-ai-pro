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

        // Presupuestos
        const presupuestoTotal = items.reduce((sum, item) =>
            sum + item.data.datosGenerales.presupuesto, 0
        );
        const presupuestoPromedio = presupuestoTotal / totalLicitaciones;

        // Importes adjudicados
        const importeAdjudicadoTotal = items.reduce((sum, item) =>
            sum + (item.data.metadata?.importeAdjudicado || 0), 0
        );

        // Tiempo promedio (estimado desde primera a última licitación)
        const timestamps = items.map(i => i.timestamp).sort((a, b) => a - b);
        const tiempoAnalisisPromedio = timestamps.length > 1
            ? (timestamps[timestamps.length - 1] - timestamps[0]) / timestamps.length
            : 0;

        // Distribución de estados
        const distribucionEstados: Record<string, number> = {};
        items.forEach(item => {
            const estado = item.data.metadata?.estado || 'SIN_ESTADO';
            distribucionEstados[estado] = (distribucionEstados[estado] || 0) + 1;
        });

        // Distribución de riesgos
        const distribucionRiesgos: Record<string, number> = {};
        items.forEach(item => {
            item.data.restriccionesYRiesgos.riesgos.forEach(riesgo => {
                distribucionRiesgos[riesgo.impacto] = (distribucionRiesgos[riesgo.impacto] || 0) + 1;
            });
        });

        // Top clientes
        const clienteMap = new Map<string, { count: number; total: number }>();
        items.forEach(item => {
            const cliente = item.data.metadata?.cliente;
            if (cliente) {
                const existing = clienteMap.get(cliente) || { count: 0, total: 0 };
                clienteMap.set(cliente, {
                    count: existing.count + 1,
                    total: existing.total + item.data.datosGenerales.presupuesto,
                });
            }
        });

        const topClientes = Array.from(clienteMap.entries())
            .map(([cliente, stats]) => ({ cliente, ...stats }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10); // Top 10

        // Top tags
        const tagMap = new Map<string, number>();
        items.forEach(item => {
            item.data.metadata?.tags?.forEach(tag => {
                tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
            });
        });

        const topTags = Array.from(tagMap.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15); // Top 15

        // Promedio Criterios
        const totalSubjetivos = items.reduce((sum, item) => sum + item.data.criteriosAdjudicacion.subjetivos.length, 0);
        const totalObjetivos = items.reduce((sum, item) => sum + item.data.criteriosAdjudicacion.objetivos.length, 0);
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
