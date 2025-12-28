import { formatCurrency, formatDate } from '../../lib/formatters';
import { useHistory } from '../../hooks/useHistory';
import { LicitacionData } from '../../types';
import { Card, CardContent } from '../../components/ui/Card';
import { FileText, Calendar, Euro, ChevronRight, Clock } from 'lucide-react';

interface HistoryViewProps {
    onSelect: (data: LicitacionData, hash?: string) => void;
}



// Removed interface HistoryItem (now imported or inferred if needed, but easier to just let hook handle it)

export function HistoryView({ onSelect }: HistoryViewProps) {
    const { items, loading } = useHistory();

    // Removed local loadHistory, useEffect, items/loading state

    // Removed local formatDate and formatCurrency functions in favor of imported ones.

    if (loading) {
        return <div className="text-center py-12 text-slate-500">Cargando historial...</div>;
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                    <Clock size={32} />
                </div>
                <h3 className="text-lg font-medium text-slate-900">No hay historial</h3>
                <p className="text-slate-500">Los documentos analizados aparecerán aquí.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Historial de Análisis</h2>
            <div className="grid gap-4">
                {items.map((item) => (
                    <Card
                        key={item.hash}
                        className="hover:shadow-md transition-shadow cursor-pointer group border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        onClick={() => onSelect(item.data, item.hash)}
                    >
                        <CardContent className="p-6 flex items-center justify-between">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-brand-50 dark:bg-brand-900/20 text-brand-600 rounded-lg group-hover:bg-brand-100 dark:group-hover:bg-brand-900/40 transition-colors">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-slate-900 dark:text-white text-lg line-clamp-1">
                                            {item.data.datosGenerales.titulo}
                                        </h3>
                                        {/* Version Badge */}
                                        {item.data.workflow && (
                                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                v{item.data.workflow.current_version}
                                            </span>
                                        )}
                                        {/* Status Badge */}
                                        {item.data.workflow?.status === 'failed' && (
                                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                                Fallido
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400 mt-2">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={14} />
                                            {formatDate(item.timestamp)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Euro size={14} />
                                            {formatCurrency(item.data.datosGenerales.presupuesto, item.data.datosGenerales.moneda)}
                                        </span>

                                        {/* Quality & Warnings */}
                                        {item.data.workflow?.quality && (
                                            <>
                                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${item.data.workflow.quality.overall === 'COMPLETO' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        item.data.workflow.quality.overall === 'PARCIAL' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}>
                                                    {item.data.workflow.quality.overall}
                                                </span>
                                                {(item.data.workflow.quality.warnings?.length || 0) > 0 && (
                                                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 text-xs">
                                                        <Clock size={14} /> {/* Fallback icon, could be AlertTriangle */}
                                                        {item.data.workflow.quality.warnings?.length} warnings
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <ChevronRight className="text-slate-300 group-hover:text-brand-500 transition-colors" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
