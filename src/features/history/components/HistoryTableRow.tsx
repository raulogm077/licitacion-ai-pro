import { useState } from "react";
import { Calendar, Building2, Eye } from "lucide-react";
import { formatCurrency, formatDate } from '../../../lib/formatters';
import { cn } from "../../../lib/utils";
import { StatusBadge } from "./StatusBadge";
import { HistoryItem } from '../../../hooks/useHistory';
import { getStatusFromData } from "../utils";

export function HistoryTableRow({
    item,
    isEven,
    onSelect
}: {
    item: HistoryItem;
    isEven: boolean;
    onSelect: () => void;
}) {
    const [hovered, setHovered] = useState(false);
    const estado = getStatusFromData(item.data);

    const cliente = item.data.metadata?.cliente || item.data.datosGenerales.organoContratacion || "Desconocido";

    return (
        <tr
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={cn(
                "transition-colors",
                hovered
                    ? "bg-brand-50/50 dark:bg-slate-700"
                    : isEven
                        ? "bg-white dark:bg-slate-800"
                        : "bg-slate-50/50 dark:bg-slate-800/50"
            )}
        >
            <td className="px-5 py-3.5">
                <div>
                    <p className="font-medium text-slate-900 dark:text-white leading-snug line-clamp-2">
                        {item.data.datosGenerales.titulo}
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
                    {formatCurrency(item.data.datosGenerales.presupuesto, item.data.datosGenerales.moneda)}
                </span>
            </td>

            <td className="px-4 py-3.5 text-center">
                <StatusBadge estado={estado} />
            </td>

            <td className="px-4 py-3.5 text-center">
                <button
                    onClick={onSelect}
                    aria-label={`Ver detalles de ${item.data.datosGenerales.titulo}`}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 hover:border-brand-600 dark:hover:text-brand-400 dark:hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                >
                    <Eye className="w-3.5 h-3.5" />
                    Ver
                </button>
            </td>
        </tr>
    );
}
