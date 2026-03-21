
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { PieChart, AlertTriangle } from 'lucide-react';
import { AnalyticsData } from '../../../types';

interface ChartsSectionProps {
    analytics: AnalyticsData;
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ analytics }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

            {/* Advertencias Distribution */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-amber-500" />
                        Advertencias de Consistencia
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {Object.keys(analytics.distribucionAdvertencias || {}).length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-4">No hay advertencias registradas</p>
                        ) : (
                            Object.entries(analytics.distribucionAdvertencias)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 5) // top 5
                                .map(([advertencia, count]) => (
                                    <div key={advertencia} className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate" title={advertencia}>
                                            {advertencia}
                                        </span>
                                        <Badge variant="outline" className="shrink-0">{count}</Badge>
                                    </div>
                                ))
                        )}
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
    );
};
