import { useState } from 'react';
import { Calendar, Building2, Eye, Trash2, Loader2 } from 'lucide-react';
import { unwrap } from '../../../lib/tracked-field';
import { formatCurrency, formatDate } from '../../../lib/formatters';
import { cn } from '../../../lib/utils';
import { StatusBadge } from './StatusBadge';
import { HistoryItem } from '../../../hooks/useHistory';
import { getStatusFromData } from '../utils';

export function HistoryTableRow({
    item,
    isEven,
    onSelect,
    onDelete,
    isDeleting,
}: {
    item: HistoryItem;
    isEven: boolean;
    onSelect: () => void;
    onDelete: () => void;
    isDeleting: boolean;
}) {
    const [hovered, setHovered] = useState(false);
    const estado = getStatusFromData(item.data);

    const cliente = item.data.metadata?.cliente || unwrap(item.data.datosGenerales.organoContratacion) || 'Desconocido';

    return (
        <tr
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={cn(
                'transition-colors',
                isDeleting && 'opacity-50',
                hovered
                    ? 'bg-brand-50/50 dark:bg-slate-700'
                    : isEven
                      ? 'bg-white dark:bg-slate-800'
                      : 'bg-slate-50/50 dark:bg-slate-800/50'
            )}
        >
            <td className="px-5 py-3.5">
                <div>
                    <p className="font-medium text-slate-900 dark:text-white leading-snug line-clamp-2">
                        {unwrap(item.data.datosGenerales.titulo)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                        {item.hash.substring(0, 12)}...
                    </p>
                </div>
            </td>

            <td className="px-4 py-3.5">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                    </div>
                    <span className="text-slate-900 dark:text-slate-200 text-sm leading-snug line-clamp-1">
                        {cliente}
                    </span>
                </div>
            </td>

            <td className="px-4 py-3.5 whitespace-nowrap">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-sm">{formatDate(item.timestamp)}</span>
                </div>
            </td>

            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(
                        unwrap(item.data.datosGenerales.presupuesto),
                        unwrap(item.data.datosGenerales.moneda)
                    )}
                </span>
            </td>

            <td className="px-4 py-3.5 text-center">
                <StatusBadge estado={estado} />
            </td>

            <td className="px-4 py-3.5 text-center">
                <div className="inline-flex items-center gap-1.5">
                    <button
                        onClick={onSelect}
                        aria-label={`Ver detalles de ${unwrap(item.data.datosGenerales.titulo)}`}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 hover:border-brand-600 dark:hover:text-brand-400 dark:hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        Ver
                    </button>
                    <button
                        onClick={onDelete}
                        disabled={isDeleting}
                        aria-label="Eliminar análisis"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isDeleting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                        )}
                    </button>
                </div>
            </td>
        </tr>
    );
}
