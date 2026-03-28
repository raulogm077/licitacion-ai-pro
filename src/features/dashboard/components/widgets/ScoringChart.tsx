import { BarChart2 } from 'lucide-react';
import { PliegoVM } from '../../model/pliego-vm';

export function ScoringChart({ vm }: { vm: PliegoVM }) {
    const clx = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

    // Extract actual scoring criteria from VM
    const { subjetivos, objetivos } = vm.result.criteriosAdjudicacion;
    const totalSub = subjetivos.reduce((acc, c) => acc + (c.ponderacion || 0), 0);
    const totalObj = objetivos.reduce((acc, c) => acc + (c.ponderacion || 0), 0);
    const total = totalSub + totalObj || 100; // Avoid division by zero

    const criteriaData = [
        ...objetivos.map((o) => ({
            label: o.descripcion,
            points: o.ponderacion || 0,
            percentage: ((o.ponderacion || 0) / total) * 100,
            color: 'bg-navy',
            type: 'automatic',
        })),
        ...subjetivos.map((s) => ({
            label: s.descripcion,
            points: s.ponderacion || 0,
            percentage: ((s.ponderacion || 0) / total) * 100,
            color: 'bg-cyan-muted',
            type: 'judgement',
        })),
    ];

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-navy/10">
                        <BarChart2 className="w-3.5 h-3.5 text-navy" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight">Distribución de Criterios</h3>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm bg-navy" />
                        Automático
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm bg-cyan-muted" />
                        Juicio de valor
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-4 flex-1">
                {criteriaData.length === 0 ? (
                    <div className="text-center text-slate-400 py-8 text-sm">
                        No hay criterios de adjudicación detectados.
                    </div>
                ) : (
                    <>
                        {/* Stacked bar */}
                        <div className="flex h-6 rounded overflow-hidden gap-[2px]">
                            {criteriaData.map((c, i) => (
                                <div
                                    key={i}
                                    className={clx(
                                        c.color,
                                        'flex items-center justify-center transition-all duration-300 hover:opacity-80'
                                    )}
                                    style={{ width: `${c.percentage}%` }}
                                    title={`${c.label}: ${c.points} pts`}
                                >
                                    {c.percentage >= 15 && (
                                        <span className="text-[10px] font-bold text-white">{c.points}</span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Legend rows */}
                        <div className="space-y-3 pt-2">
                            {criteriaData.slice(0, 5).map((c, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className={clx(`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${c.color}`)} />
                                    <span
                                        className="flex-1 text-xs text-slate-700 font-medium truncate"
                                        title={c.label}
                                    >
                                        {c.label}
                                    </span>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xs font-bold text-slate-800 w-10 text-right">
                                            {c.points} pts
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {criteriaData.length > 5 && (
                                <div className="text-xs text-slate-400 italic text-center pt-2">
                                    + {criteriaData.length - 5} criterios más...
                                </div>
                            )}
                        </div>

                        <div className="pt-3 mt-auto flex items-center justify-between border-t border-slate-100 text-xs">
                            <span className="text-slate-500">Total puntos detectados</span>
                            <span className="font-bold text-slate-900">{totalSub + totalObj} puntos</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
