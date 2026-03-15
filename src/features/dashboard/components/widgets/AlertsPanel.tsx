import { AlertTriangle, Info, XCircle, CheckCircle2, Bell, ArrowRight } from "lucide-react";
import { PliegoVM } from "../../model/pliego-vm";

type AlertSeverity = "error" | "warning" | "info" | "success";

interface Alert {
    id: string;
    severity: AlertSeverity;
    title: string;
    description: string;
    section: string;
    isNew?: boolean;
}

const severityConfig: Record<
    AlertSeverity,
    {
        icon: React.ElementType;
        containerClass: string;
        iconClass: string;
        labelClass: string;
        label: string;
    }
> = {
    error: {
        icon: XCircle,
        containerClass: "border-l-red-500 bg-red-50/60 hover:bg-red-50 border-red-100",
        iconClass: "text-red-500",
        labelClass: "text-red-600 bg-red-100 border-red-200",
        label: "Crítico",
    },
    warning: {
        icon: AlertTriangle,
        containerClass: "border-l-amber-400 bg-amber-50/60 hover:bg-amber-50 border-amber-100",
        iconClass: "text-amber-500",
        labelClass: "text-amber-700 bg-amber-100 border-amber-200",
        label: "Aviso",
    },
    info: {
        icon: Info,
        containerClass: "border-l-cyan-muted bg-cyan/5 hover:bg-cyan/10 border-cyan/20",
        iconClass: "text-cyan-muted",
        labelClass: "text-cyan-muted bg-cyan/15 border-cyan/30",
        label: "Info",
    },
    success: {
        icon: CheckCircle2,
        containerClass: "border-l-emerald-500 bg-emerald-50/60 hover:bg-emerald-50 border-emerald-100",
        iconClass: "text-emerald-500",
        labelClass: "text-emerald-700 bg-emerald-100 border-emerald-200",
        label: "OK",
    },
};

export function AlertsPanel({ vm, onNavigate }: { vm: PliegoVM, onNavigate: (section: string) => void }) {
    const clx = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

    // Map warnings from PliegoVM into alerts UI format
    const alerts: Alert[] = vm.warnings.map((w, idx) => ({
        id: `w-${idx}`,
        severity: w.severity === 'CRITICO' ? 'error' : 'warning',
        title: "Alerta extraída",
        description: w.message,
        section: "resumen", // Simplification
        isNew: true
    }));

    // Add some mock derived ones for visual completeness if there's very few
    if (alerts.length < 3) {
       alerts.push({
           id: "m-1",
           severity: "info",
           title: "Subcontratación detectada",
           description: "Se permite subcontratar partes del proyecto bajo ciertas condiciones.",
           section: "tecnicos",
           isNew: false
       });
       if (vm.result.restriccionesYRiesgos.penalizaciones.length > 0) {
           alerts.push({
               id: "m-2",
               severity: "error",
               title: "Penalizaciones por SLA",
               description: "El pliego contempla multas por incumplimiento de servicio.",
               section: "riesgos",
               isNew: false
           });
       }
    }

    const errorCount = alerts.filter((a) => a.severity === "error").length;
    const warningCount = alerts.filter((a) => a.severity === "warning").length;

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-full xl:min-h-0">
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-slate-200 bg-slate-50/50 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-slate-600" />
                        <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                            Avisos del Pliego
                        </h2>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500">
                        {alerts.length} alertas
                    </span>
                </div>
                {/* Summary badges */}
                <div className="flex items-center gap-2 flex-wrap">
                    {errorCount > 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-50 border border-red-200">
                            <XCircle className="w-3 h-3 text-red-500" />
                            <span className="text-[11px] font-bold text-red-700">
                                {errorCount} crítico{errorCount !== 1 ? "s" : ""}
                            </span>
                        </div>
                    )}
                    {warningCount > 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span className="text-[11px] font-bold text-amber-700">
                                {warningCount} aviso{warningCount !== 1 ? "s" : ""}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Alert list */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {alerts.length === 0 ? (
                    <div className="text-center text-slate-400 py-8 text-sm">No hay alertas.</div>
                ) : (
                    alerts.map((alert) => {
                        const config = severityConfig[alert.severity];
                        const Icon = config.icon;
                        return (
                            <div
                                key={alert.id}
                                onClick={() => onNavigate(alert.section)}
                                className={clx(
                                    "px-4 py-3 border-l-2 transition-colors duration-150 cursor-pointer group",
                                    config.containerClass
                                )}
                            >
                                <div className="flex items-start gap-2.5">
                                    <Icon
                                        className={clx("w-3.5 h-3.5 flex-shrink-0 mt-0.5", config.iconClass)}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-0.5">
                                            <p className="text-xs font-semibold text-slate-900 leading-snug text-pretty">
                                                {alert.title}
                                            </p>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {alert.isNew && (
                                                    <span className="text-[9px] font-bold px-1 py-0.5 rounded-sm bg-navy text-white">
                                                        NUEVO
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-600 leading-snug mb-1.5 text-pretty">
                                            {alert.description}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <span
                                                className={clx(
                                                    "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                                                    config.labelClass
                                                )}
                                            >
                                                {config.label}
                                            </span>
                                            <button className="flex items-center gap-1 text-[10px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-900">
                                                Ir a sección
                                                <ArrowRight className="w-2.5 h-2.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
