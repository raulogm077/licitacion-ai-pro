import { useEffect, useState } from 'react';
import { AnalyticsData } from '../../types';
import { AnalyticsService } from '../../services/analytics.service';
import { services } from '../../config/service-registry';
import { TrendingUp, BarChart3, Download } from 'lucide-react';
import { exportAnalyticsToExcel } from '../../lib/export-utils';
import { logger } from '../../services/logger';

// Sub-components
import { KPICards } from './components/KPICards';
import { ChartsSection } from './components/ChartsSection';
import { TopLists } from './components/TopLists';
import { CriteriaStats } from './components/CriteriaStats';

export const AnalyticsDashboard: React.FC = () => {
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const result = await services.db.getAllLicitaciones();
                if (result.ok) {
                    const data = AnalyticsService.calculateAnalytics(result.value);
                    setAnalytics(data);
                }
            } catch (error) {
                logger.error('Failed to load analytics:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    if (isLoading) {
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
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="text-brand-600" />
                    Analytics Dashboard
                </h2>
                <button
                    data-testid="export-excel-btn"
                    onClick={() => analytics && exportAnalyticsToExcel(analytics, `analytics-${new Date().toISOString().split('T')[0]}`)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-sm font-medium"
                >
                    <Download size={16} /> Exportar Datos (.xlsx)
                </button>
            </div>

            {/* Modular Components */}
            <KPICards analytics={analytics} />
            <ChartsSection analytics={analytics} />
            <TopLists analytics={analytics} />
            <CriteriaStats analytics={analytics} />
        </div>
    );
};
