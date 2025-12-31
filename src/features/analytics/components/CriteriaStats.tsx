
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { TrendingUp } from 'lucide-react';
import { AnalyticsData } from '../../../types';

interface CriteriaStatsProps {
    analytics: AnalyticsData;
}

export const CriteriaStats: React.FC<CriteriaStatsProps> = ({ analytics }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-brand-600" />
                    Promedio de Criterios por Licitación
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col items-center justify-center p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                        <span className="text-4xl font-bold text-blue-700 dark:text-blue-300">
                            {analytics.promedioCriterios.subjetivos.toFixed(1)}
                        </span>
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-2">Criterios Subjetivos</span>
                        <p className="text-xs text-blue-500 mt-1 text-center">Basados en juicio de valor</p>
                    </div>
                    <div className="flex flex-col items-center justify-center p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                        <span className="text-4xl font-bold text-emerald-700 dark:text-emerald-300">
                            {analytics.promedioCriterios.objetivos.toFixed(1)}
                        </span>
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-2">Criterios Objetivos</span>
                        <p className="text-xs text-emerald-500 mt-1 text-center">Basados en fórmulas automáticas</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
