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

        let presupuestoTotal = 0;
        let importeAdjudicadoTotal = 0;
        const distribucionEstados: Record<string, number> = {};
        const distribucionRiesgos: Record<string, number> = {};
        const clienteMap = new Map<string, { count: number; total: number }>();
        const tagMap = new Map<string, number>();
        let totalSubjetivos = 0;
        let totalObjetivos = 0;

        let minTimestamp = Infinity;
        let maxTimestamp = -Infinity;

        // Optimización: Un solo recorrido para todas las métricas O(n)
        for (let i = 0; i < totalLicitaciones; i++) {
            const item = items[i];
            const data = item.data;

            // Timestamps
            if (item.timestamp < minTimestamp) minTimestamp = item.timestamp;
            if (item.timestamp > maxTimestamp) maxTimestamp = item.timestamp;

            // Presupuestos
            const presupuesto = data.datosGenerales?.presupuesto || 0;
            presupuestoTotal += presupuesto;

            // Metadatos (importe, estado, cliente, tags)
            const metadata = data.metadata;
            if (metadata) {
                importeAdjudicadoTotal += metadata.importeAdjudicado || 0;

                const estado = metadata.estado || 'SIN_ESTADO';
                distribucionEstados[estado] = (distribucionEstados[estado] || 0) + 1;

                const cliente = metadata.cliente;
                if (cliente) {
                    const existing = clienteMap.get(cliente);
                    if (existing) {
                        existing.count += 1;
                        existing.total += presupuesto;
                    } else {
                        clienteMap.set(cliente, { count: 1, total: presupuesto });
                    }
                }

                const tags = metadata.tags;
                if (tags) {
                    for (let j = 0; j < tags.length; j++) {
                        const tag = tags[j];
                        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
                    }
                }
            } else {
                distribucionEstados['SIN_ESTADO'] = (distribucionEstados['SIN_ESTADO'] || 0) + 1;
            }

            // Riesgos
            const riesgos = data.restriccionesYRiesgos?.riesgos;
            if (riesgos) {
                for (let j = 0; j < riesgos.length; j++) {
                    const impacto = riesgos[j].impacto;
                    distribucionRiesgos[impacto] = (distribucionRiesgos[impacto] || 0) + 1;
                }
            }

            // Criterios
            totalSubjetivos += data.criteriosAdjudicacion?.subjetivos?.length || 0;
            totalObjetivos += data.criteriosAdjudicacion?.objetivos?.length || 0;
        }

        const presupuestoPromedio = presupuestoTotal / totalLicitaciones;

        // Tiempo promedio (estimado desde primera a última licitación)
        const tiempoAnalisisPromedio = totalLicitaciones > 1
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
