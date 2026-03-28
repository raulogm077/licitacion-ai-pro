import React from 'react';
import { CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { AnalysisStatus } from '../utils';

export function StatusBadge({ estado }: { estado: AnalysisStatus }) {
    const config: Record<AnalysisStatus, { label: string; icon: React.ReactNode; className: string }> = {
        COMPLETO: {
            label: 'Exitoso',
            icon: <CheckCircle2 className="w-3.5 h-3.5" />,
            className:
                'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
        },
        failed: {
            label: 'Fallido',
            icon: <XCircle className="w-3.5 h-3.5" />,
            className:
                'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
        },
        PARCIAL: {
            label: 'Parcial',
            icon: <AlertCircle className="w-3.5 h-3.5" />,
            className:
                'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
        },
        desconocido: {
            label: 'Desconocido',
            icon: <Clock className="w-3.5 h-3.5" />,
            className:
                'bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
        },
    };

    const { label, icon, className } = config[estado];

    return (
        <span
            className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', className)}
        >
            {icon}
            {label}
        </span>
    );
}
