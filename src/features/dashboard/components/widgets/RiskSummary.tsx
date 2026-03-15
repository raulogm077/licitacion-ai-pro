import { ShieldAlert } from "lucide-react";
import { PliegoVM } from "../../model/pliego-vm";

export function RiskSummary({ vm }: { vm: PliegoVM }) {
    const clx = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

    // Convert Pliego restrictions into risk display format
    const rs = vm.result.restriccionesYRiesgos;

    const risks = [
        ...rs.killCriteria.map(kc => ({
            id: kc.criterio,
            label: kc.criterio,
            level: "Alto",
            levelClass: "text-red-600 bg-red-50 border-red-200",
            barClass: "bg-red-500",
            barWidth: "85%",
        })),
        ...rs.penalizaciones.map(p => ({
            id: p.causa,
            label: p.causa,
            level: "Medio",
            levelClass: "text-amber-600 bg-amber-50 border-amber-200",
            barClass: "bg-amber-400",
            barWidth: "50%",
        })),
        ...rs.riesgos.map(r => ({
            id: r.descripcion,
            label: r.descripcion,
            level: "Bajo",
            levelClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
            barClass: "bg-emerald-500",
            barWidth: "25%",
        }))
    ].slice(0, 5); // Limit to top 5

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-red-50">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                        Mapa de Riesgos Identificados
                    </h3>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    {vm.counts.riesgos} riesgos
                </span>
            </div>

            <div className="p-5 space-y-3 flex-1 overflow-y-auto">
                {risks.length === 0 ? (
                    <div className="text-center text-slate-400 py-8 text-sm">No se detectaron riesgos ni penalizaciones críticas.</div>
                ) : (
                    risks.map((risk, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-3 group hover:bg-slate-50 -mx-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-800 truncate" title={risk.label}>
                                    {risk.label}
                                </p>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                                    <div
                                        className={clx(
                                            "h-full rounded-full transition-all duration-500",
                                            risk.barClass
                                        )}
                                        style={{ width: risk.barWidth }}
                                    />
                                </div>
                            </div>
                            <span
                                className={clx(
                                    "text-[10px] font-bold px-2 py-0.5 rounded border flex-shrink-0 w-14 text-center",
                                    risk.levelClass
                                )}
                            >
                                {risk.level}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
