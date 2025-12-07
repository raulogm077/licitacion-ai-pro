import { useEffect, useState } from 'react';
import { AnalyticsData } from '../../types';
import { AnalyticsService } from '../../lib/analytics-service';
import { dbService } from '../../lib/db-service';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import {
    TrendingUp, Euro, Clock, FileText, Users, Tag as TagIcon,
    AlertTriangle, CheckCircle, PieChart, BarChart3
} from 'lucide-react';

export function AnalyticsDashboard() {
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAnalytics();
    }, []);

    const loadAnalytics = async () => {
        try {
            const items = await dbService.getAllLicitaciones();
            const data = AnalyticsService.calculateAnalytics(items);
            setAnalytics(data);
        } catch (error) {
            console.error('Failed to load analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="text-center py-12 text-slate-500">Cargando analytics...</div>;
    }

    if (!analytics || analytics.totalLicitaciones === 0) {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                    <BarChart3 size={32} />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">No hay datos de analytics</h3>
                <p className="text-slate-500 dark:text-slate-400">Analiza algunos documentos para ver métricas.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="text-brand-600" />
                Analytics Dashboard
            </h2>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Licitaciones</h3>
                            <FileText className="text-brand-500" size={20} />
                        </div>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white">
                            {AnalyticsService.formatNumber(analytics.totalLicitaciones)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Presupuesto Total</h3>
                            <Euro className="text-emerald-500" size={20} />
                        </div>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white">
                            {AnalyticsService.formatCurrency(analytics.presupuestoTotal)}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            Promedio: {AnalyticsService.formatCurrency(analytics.presupuestoPromedio)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Importe Adjudicado</h3>
                            <CheckCircle className="text-green-500" size={20} />
                        </div>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white">
                            {AnalyticsService.formatCurrency(analytics.importeAdjudicadoTotal)}
                        </p>
                        {analytics.presupuestoTotal > 0 && (
                            <p className="text-xs text-slate-400 mt-1">
                                {((analytics.importeAdjudicadoTotal / analytics.presupuestoTotal) * 100).toFixed(1)}% del total
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Tiempo Promedio</h3>
                            <Clock className="text-blue-500" size={20} />
                        </div>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white">
                            {AnalyticsService.formatDuration(analytics.tiempoAnalisisPromedio)}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Por análisis</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Estados Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieChart size={18} className="text-brand-600" />
                            Distribución por Estado
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {Object.entries(analytics.distribucionEstados).map(([estado, count]) => {
                                const percentage = (count / analytics.totalLicitaciones) * 100;
                                const color = {
                                    PENDIENTE: 'bg-yellow-500',
                                    EN_REVISION: 'bg-blue-500',
                                    ADJUDICADA: 'bg-green-500',
                                    DESCARTADA: 'bg-red-500',
                                    SIN_ESTADO: 'bg-gray-400',
                                }[estado] || 'bg-slate-500';

                                return (
                                    <div key={estado}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {estado.replace('_', ' ')}
                                            </span>
                                            <span className="text-sm text-slate-500">
                                                {count} ({percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                            <div
                                                className={`${color} h-2 rounded-full transition-all duration-500`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Riesgos Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle size={18} className="text-orange-600" />
                            Distribución de Riesgos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {Object.entries(analytics.distribucionRiesgos).sort((a, b) => b[1] - a[1]).map(([impacto, count]) => {
                                const color = {
                                    CRITICO: 'bg-red-600',
                                    ALTO: 'bg-orange-500',
                                    MEDIO: 'bg-yellow-500',
                                    BAJO: 'bg-green-500',
                                }[impacto] || 'bg-slate-500';

                                return (
                                    <div key={impacto} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${color}`} />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {impacto}
                                            </span>
                                        </div>
                                        <Badge variant="outline">{count}</Badge>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Clientes */}
                {analytics.topClientes.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users size={18} className="text-brand-600" />
                                Top Clientes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {analytics.topClientes.map((cliente, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white">{cliente.cliente}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {cliente.count} {cliente.count === 1 ? 'licitación' : 'licitaciones'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-brand-600">
                                                {AnalyticsService.formatCurrency(cliente.total)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Top Tags */}
                {analytics.topTags.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TagIcon size={18} className="text-brand-600" />
                                Tags Más Usados
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {analytics.topTags.map((tag, idx) => (
                                    <Badge
                                        key={idx}
                                        variant="default"
                                        className="text-sm px-3 py-1.5 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                                    >
                                        {tag.tag}
                                        <span className="ml-2 font-bold">{tag.count}</span>
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
