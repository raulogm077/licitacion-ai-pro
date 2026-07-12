import { ShieldAlert } from 'lucide-react';
import { PliegoVM } from '../../model/pliego-vm';
import { cn } from '../../../../lib/utils';

const LEVELS = [
    {
        key: 'alto' as const,
        label: 'Alto',
        chipClass:
            'text-danger-dark bg-danger-light border-danger/30 dark:text-danger-light dark:bg-danger/20 dark:border-danger/40',
        barClass: 'bg-danger',
    },
    {
        key: 'medio' as const,
        label: 'Medio',
        chipClass:
            'text-warning-dark bg-warning-light border-warning/30 dark:text-warning-light dark:bg-warning/20 dark:border-warning/40',
        barClass: 'bg-warning',
    },
    {
        key: 'bajo' as const,
        label: 'Bajo',
        chipClass:
            'text-success-dark bg-success-light border-success/30 dark:text-success-light dark:bg-success/20 dark:border-success/40',
        barClass: 'bg-success',
    },
];

export function RiskSummary({ vm }: { vm: PliegoVM }) {
    const rs = vm.result.restriccionesYRiesgos;

    // Severity comes from the source category: exclusion criteria are blocking
    // (alto), penalties cost money (medio), generic risks need review (bajo).
    const counts = {
        alto: rs.killCriteria.length,
        medio: rs.penalizaciones.length,
        bajo: rs.riesgos.length,
    };
    const total = counts.alto + counts.medio + counts.bajo;

    const risks = [
        ...rs.killCriteria.map((kc) => ({ id: kc.criterio, label: kc.criterio, level: LEVELS[0] })),
        ...rs.penalizaciones.map((p) => ({ id: p.causa, label: p.causa, level: LEVELS[1] })),
        ...rs.riesgos.map((r) => ({ id: r.descripcion, label: r.descripcion, level: LEVELS[2] })),
    ].slice(0, 5);

    return (
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-5 py-3.5 dark:border-slate-700 dark:bg-slate-900/50">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-danger-light dark:bg-danger/20">
                        <ShieldAlert className="h-3.5 w-3.5 text-danger" />
                    </div>
                    <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                        Mapa de Riesgos Identificados
                    </h3>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {vm.counts.riesgos} riesgos
                </span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {total === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-400">
                        No se detectaron riesgos ni penalizaciones críticas.
                    </div>
                ) : (
                    <>
                        {/* Severity distribution with real proportions */}
                        <div>
                            <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                {LEVELS.map(
                                    (level) =>
                                        counts[level.key] > 0 && (
                                            <div
                                                key={level.key}
                                                className={cn('h-full transition-all duration-700', level.barClass)}
                                                style={{ width: `${(counts[level.key] / total) * 100}%` }}
                                            />
                                        )
                                )}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                {LEVELS.map((level) => (
                                    <span
                                        key={level.key}
                                        className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
                                    >
                                        <span className={cn('h-2 w-2 rounded-sm', level.barClass)} />
                                        {level.label}: <strong>{counts[level.key]}</strong>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1">
                            {risks.map((risk, i) => (
                                <div
                                    key={i}
                                    className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                >
                                    <p
                                        className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 dark:text-slate-200"
                                        title={risk.label}
                                    >
                                        {risk.label}
                                    </p>
                                    <span
                                        className={cn(
                                            'w-14 flex-shrink-0 rounded border px-2 py-0.5 text-center text-[10px] font-bold',
                                            risk.level.chipClass
                                        )}
                                    >
                                        {risk.level.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
