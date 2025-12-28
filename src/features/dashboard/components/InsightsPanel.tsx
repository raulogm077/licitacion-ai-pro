import { LicitacionData } from '../../../types';
import { AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';

interface InsightsPanelProps {
    data: LicitacionData;
}

export function InsightsPanel({ data }: InsightsPanelProps) {
    const quality = data.workflow?.quality;
    const missingFields = quality?.missingCriticalFields || [];
    const warnings = quality?.warnings || [];

    return (
        <div className="space-y-6 sticky top-24">
            {/* Quality Score Card */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">
                        Calidad del Análisis
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 mb-4">
                        <div className={`text-2xl font-bold ${quality?.overall === 'COMPLETO' ? 'text-green-600' :
                            quality?.overall === 'PARCIAL' ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                            {quality?.overall || 'N/A'}
                        </div>
                    </div>

                    {missingFields.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-red-500 uppercase">Faltantes Críticos</h4>
                            <ul className="text-sm space-y-1">
                                {missingFields.map((field, i) => (
                                    <li key={i} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                        <Info size={14} className="text-red-400" />
                                        {field}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Warnings Card */}
            {warnings.length > 0 && (
                <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400 flex items-center gap-2">
                            <AlertTriangle size={16} />
                            Warnings
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="text-sm space-y-2">
                            {warnings.map((warn, i) => (
                                <li key={i} className="text-orange-800 dark:text-orange-300">
                                    • {warn}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* Version Info */}
            <Card>
                <CardContent className="pt-6">
                    <div className="space-y-4 text-sm">
                        <div className="flex justified-between items-center">
                            <span className="text-slate-500">Versión Actual</span>
                            <span className="font-medium">v{data.versions?.length || 1}</span>
                        </div>
                        <div className="flex justified-between items-center">
                            <span className="text-slate-500">Modelo</span>
                            <span className="font-medium ml-auto">Gemini Pro</span>
                        </div>
                        <div className="flex justified-between items-center">
                            <span className="text-slate-500">Última act.</span>
                            <span className="font-medium ml-auto">
                                {new Date(data.workflow?.updated_at || new Date().toISOString()).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
