
import React from 'react';
import { Card, CardContent } from '../../../components/ui/Card';
import { FileText, Euro, CheckCircle, Clock } from 'lucide-react';
import { AnalyticsService } from '../../../services/analytics.service';
import { AnalyticsData } from '../../../types';

interface KPICardsProps {
    analytics: AnalyticsData;
}

export const KPICards: React.FC<KPICardsProps> = ({ analytics }) => {
    return (
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
    );
};
