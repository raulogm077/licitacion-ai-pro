import { Euro, CalendarClock, Timer, TrendingUp } from 'lucide-react';
import { PliegoVM } from '../../model/pliego-vm';
import { FeedbackToggle } from '../detail/FeedbackToggle';
import { CountUp, Stagger, StaggerItem } from '../../../../components/ui/motion';
import { unwrap } from '../../../../lib/tracked-field';
import { cn } from '../../../../lib/utils';

interface KpiCardProps {
    vm: PliegoVM;
}

export function KpiCards({ vm }: KpiCardProps) {
    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('es-ES', { style: 'currency', currency: vm.display.moneda }).format(amount);

    const rawBudget = unwrap<number>(vm.result.datosGenerales.presupuesto, 0);
    const rawMonths = unwrap<number>(vm.result.datosGenerales.plazoEjecucionMeses, 0);
    const rawEstimated = vm.result.economico?.valorEstimadoContrato ?? 0;
    const dateLimit = vm.result.datosGenerales.fechaLimitePresentacion || 'No detectada';

    const kpis = [
        {
            id: 'presupuesto',
            label: 'Presupuesto Base de Licitación',
            numeric: rawBudget > 0 ? { value: rawBudget, format: formatCurrency } : null,
            fallback: 'No detectado',
            sub: 'IVA no incluido',
            icon: Euro,
            iconBg: 'bg-brand-50 dark:bg-brand-950',
            iconColor: 'text-brand-600 dark:text-brand-400',
            accent: 'border-l-brand-500',
            fieldPath: 'datosGenerales.presupuesto',
            feedbackValue: vm.display.presupuesto,
        },
        {
            id: 'fecha',
            label: 'Fecha Límite de Presentación',
            numeric: null,
            fallback: dateLimit,
            sub: 'Presentación de ofertas',
            icon: CalendarClock,
            iconBg: 'bg-warning-light dark:bg-warning/20',
            iconColor: 'text-warning-dark dark:text-warning',
            accent: 'border-l-warning',
            fieldPath: 'datosGenerales.fechaLimitePresentacion',
            feedbackValue: dateLimit,
        },
        {
            id: 'duracion',
            label: 'Duración del Contrato',
            numeric: rawMonths > 0 ? { value: rawMonths, format: (v: number) => `${Math.round(v)} meses` } : null,
            fallback: 'No detectado',
            sub: 'Duración extraída',
            icon: Timer,
            iconBg: 'bg-brand-50 dark:bg-brand-950',
            iconColor: 'text-brand-600 dark:text-brand-400',
            accent: 'border-l-brand-500',
            fieldPath: 'datosGenerales.plazoEjecucionMeses',
            feedbackValue: vm.display.plazo,
        },
        {
            id: 'valor',
            label: 'Valor Estimado Total',
            numeric: rawEstimated > 0 ? { value: rawEstimated, format: formatCurrency } : null,
            fallback: 'No detectado',
            sub: 'Solo si aparece explícito',
            icon: TrendingUp,
            iconBg: 'bg-accent-50 dark:bg-accent-900/30',
            iconColor: 'text-accent-600 dark:text-accent-400',
            accent: 'border-l-accent-500',
            fieldPath: 'economico.valorEstimadoContrato',
            feedbackValue: rawEstimated > 0 ? formatCurrency(rawEstimated) : 'No detectado',
        },
    ];

    return (
        <Stagger className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {kpis.map((kpi) => {
                const Icon = kpi.icon;
                return (
                    <StaggerItem key={kpi.id}>
                        <div
                            className={cn(
                                'flex h-full items-start gap-4 rounded-xl border border-l-2 border-slate-200 bg-white py-4 pl-4 pr-5 dark:border-slate-700 dark:bg-slate-800',
                                'shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover',
                                kpi.accent
                            )}
                        >
                            <div
                                className={cn(
                                    'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                                    kpi.iconBg
                                )}
                            >
                                <Icon className={cn('h-4 w-4', kpi.iconColor)} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-1">
                                    <p className="mb-1 text-pretty text-xs font-medium leading-tight text-slate-500 dark:text-slate-400">
                                        {kpi.label}
                                    </p>
                                    <FeedbackToggle
                                        licitacionHash={vm.hash}
                                        fieldPath={kpi.fieldPath}
                                        value={kpi.feedbackValue}
                                        className="-mt-0.5 flex-shrink-0"
                                    />
                                </div>
                                <p className="truncate text-lg font-bold leading-tight text-slate-900 tabular-nums dark:text-white">
                                    {kpi.numeric ? (
                                        <CountUp value={kpi.numeric.value} format={kpi.numeric.format} />
                                    ) : (
                                        kpi.fallback
                                    )}
                                </p>
                                <span className="mt-1.5 block text-[11px] text-slate-500 dark:text-slate-400">
                                    {kpi.sub}
                                </span>
                            </div>
                        </div>
                    </StaggerItem>
                );
            })}
        </Stagger>
    );
}
