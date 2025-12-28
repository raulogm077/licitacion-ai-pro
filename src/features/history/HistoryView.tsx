import { useEffect, useState } from 'react';
import { dbService } from '../../services/db.service';
import { LicitacionData } from '../../types';
import { Card, CardContent } from '../../components/ui/Card';
import { FileText, Calendar, Euro, ChevronRight, Clock } from 'lucide-react';

interface HistoryViewProps {
    onSelect: (data: LicitacionData, hash?: string) => void;
}

interface HistoryItem {
    hash: string;
    fileName: string;
    timestamp: number;
    data: LicitacionData;
}

export function HistoryView({ onSelect }: HistoryViewProps) {
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const history = await dbService.getAllLicitaciones();
            // Sort by timestamp desc
            const sorted = history.sort((a: HistoryItem, b: HistoryItem) => b.timestamp - a.timestamp);
            setItems(sorted);
        } catch (error) {
            console.error("Failed to load history:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (ts: number) => {
        return new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(ts));
    };

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency || 'EUR' }).format(amount);
    };

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
                                    <h3 className="font-semibold text-slate-900 dark:text-white text-lg mb-1 line-clamp-1">
                                        {item.data.datosGenerales.titulo}
                                    </h3>
                                    <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={14} />
                                            {formatDate(item.timestamp)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Euro size={14} />
                                            {formatCurrency(item.data.datosGenerales.presupuesto, item.data.datosGenerales.moneda)}
                                        </span>
                                        <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">
                                            {item.fileName}
                                        </span>
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
