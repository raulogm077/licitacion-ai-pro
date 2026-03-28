import { Euro, CalendarClock, Timer, TrendingUp } from 'lucide-react';
import { unwrap } from '../../../../lib/tracked-field';
import { PliegoVM } from '../../model/pliego-vm';
import { FeedbackToggle } from '../detail/FeedbackToggle';

// Helper type and component
interface KpiCardProps {
    vm: PliegoVM;
}

export function KpiCards({ vm }: KpiCardProps) {
    const clx = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

    const budget = vm.display.presupuesto;
    const duration = vm.display.plazo;
    const dateLimit = vm.result.datosGenerales.fechaLimitePresentacion || 'No especificada';

    // Estimate Total Value roughly (if not present) - just for UI demonstration based on 2x budget (example heuristic if not explicitly found)
    const rawBudget = unwrap(vm.result.datosGenerales.presupuesto) || 0;
    const isProrrogable = duration !== 'No detectado' && rawBudget > 0;
    const estimatedValue = rawBudget * (isProrrogable ? 1.5 : 1);
    const formattedEstimated = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: vm.display.moneda,
    }).format(estimatedValue);

    const kpis = [
        {
            id: 'presupuesto',
            label: 'Presupuesto Base de Licitación',
            value: budget,
            sub: 'IVA no incluido',
            icon: Euro,
            trend: null,
            color: 'text-navy',
            iconBg: 'bg-navy/10',
            iconColor: 'text-navy',
            accent: 'border-l-navy',
            fieldPath: 'datosGenerales.presupuesto',
        },
        {
            id: 'fecha',
            label: 'Fecha Límite de Presentación',
            value: dateLimit,
            sub: 'Verificar en portal oficial',
            icon: CalendarClock,
            trend: dateLimit !== 'No especificada' ? 'Urgente' : null,
            trendColor: 'text-amber-600 bg-amber-50 border-amber-200',
            color: 'text-amber-700',
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            accent: 'border-l-amber-400',
            fieldPath: 'datosGenerales.fechaLimitePresentacion',
        },
        {
            id: 'duracion',
            label: 'Duración del Contrato',
            value: duration,
            sub: 'Prorrogable',
            icon: Timer,
            trend: null,
            color: 'text-navy',
            iconBg: 'bg-navy/10',
            iconColor: 'text-navy',
            accent: 'border-l-navy',
            fieldPath: 'datosGenerales.duracionContrato',
        },
        {
            id: 'valor',
            label: 'Valor Estimado Total',
            value: formattedEstimated,
            sub: 'Aproximación con prórrogas',
            icon: TrendingUp,
            trend: null,
            color: 'text-navy',
            iconBg: 'bg-cyan/20',
            iconColor: 'text-cyan-muted',
            accent: 'border-l-cyan',
            fieldPath: 'datosGenerales.valorEstimado',
        },
    ];

    return (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {kpis.map((kpi) => {
                const Icon = kpi.icon;
                return (
                    <div
                        key={kpi.id}
                        className={clx(
                            'bg-white rounded-lg border border-slate-200 pl-4 pr-5 py-4 flex items-start gap-4',
                            'border-l-2 shadow-sm hover:shadow-md transition-shadow duration-200',
                            kpi.accent
                        )}
                    >
                        <div
                            className={clx(
                                'flex items-center justify-center w-9 h-9 rounded-md flex-shrink-0 mt-0.5',
                                kpi.iconBg
                            )}
                        >
                            <Icon className={clx('w-4 h-4', kpi.iconColor)} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-1">
                                <p className="text-xs text-slate-500 font-medium leading-tight mb-1 text-pretty">
                                    {kpi.label}
                                </p>
                                <FeedbackToggle
                                    fieldPath={kpi.fieldPath}
                                    value={String(kpi.value)}
                                    className="flex-shrink-0 -mt-0.5"
                                />
                            </div>
                            <p className={clx('text-lg font-bold leading-tight truncate', kpi.color)}>{kpi.value}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-[11px] text-slate-500">{kpi.sub}</span>
                                {kpi.trend && (
                                    <span
                                        className={clx(
                                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-sm border',
                                            kpi.trendColor
                                        )}
                                    >
                                        {kpi.trend}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
