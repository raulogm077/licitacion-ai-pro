import React from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { PieChart as PieChartIcon, AlertTriangle, TrendingUp } from 'lucide-react';
import { AnalyticsData } from '../../../types';

interface ChartsSectionProps {
    analytics: AnalyticsData;
}

/** Fixed estado → color assignment (identity follows the entity, never rank). */
const ESTADO_ORDER = ['EN_REVISION', 'ADJUDICADA', 'PENDIENTE', 'DESCARTADA', 'SIN_ESTADO'] as const;
const ESTADO_COLOR: Record<string, string> = {
    EN_REVISION: 'var(--viz-indigo)',
    ADJUDICADA: 'var(--viz-green)',
    PENDIENTE: 'var(--viz-amber)',
    DESCARTADA: 'var(--viz-rose)',
    SIN_ESTADO: 'var(--viz-violet)',
};

const RIESGO_COLOR: Record<string, string> = {
    CRITICO: 'var(--viz-rose)',
    ALTO: 'var(--viz-amber)',
    MEDIO: 'var(--viz-indigo)',
    BAJO: 'var(--viz-green)',
};
const RIESGO_ORDER = ['CRITICO', 'ALTO', 'MEDIO', 'BAJO'];

const tooltipStyle: React.CSSProperties = {
    borderRadius: 12,
    border: '1px solid var(--viz-grid)',
    background: 'var(--viz-tooltip-bg, #ffffff)',
    fontSize: 12,
    color: 'inherit',
};

const formatMonth = (mes: string) => {
    const [year, month] = mes.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
};

export const ChartsSection: React.FC<ChartsSectionProps> = ({ analytics }) => {
    const estadoData = ESTADO_ORDER.filter((estado) => analytics.distribucionEstados[estado] > 0).map((estado) => ({
        name: estado.replace('_', ' '),
        estado,
        value: analytics.distribucionEstados[estado],
    }));

    const evolutionData = analytics.evolucionMensual.map((m) => ({ ...m, label: formatMonth(m.mes) }));

    const riesgosTotal = Object.values(analytics.distribucionRiesgos).reduce((a, b) => a + b, 0);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Estados donut */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <PieChartIcon size={18} className="text-brand-600 dark:text-brand-400" />
                            Distribución por Estado
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {estadoData.length === 0 ? (
                            <p className="py-12 text-center text-sm text-slate-400">Sin datos de estado.</p>
                        ) : (
                            <div className="flex flex-col items-center gap-4 sm:flex-row">
                                <div className="h-52 w-52 flex-shrink-0" aria-hidden="true">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={estadoData}
                                                dataKey="value"
                                                nameKey="name"
                                                innerRadius={55}
                                                outerRadius={85}
                                                paddingAngle={2}
                                                strokeWidth={0}
                                                isAnimationActive={false}
                                            >
                                                {estadoData.map((entry) => (
                                                    <Cell key={entry.estado} fill={ESTADO_COLOR[entry.estado]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Legend doubles as the accessible table of values */}
                                <ul className="w-full space-y-2">
                                    {estadoData.map((entry) => (
                                        <li
                                            key={entry.estado}
                                            className="flex items-center justify-between gap-3 text-sm"
                                        >
                                            <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                <span
                                                    className="h-2.5 w-2.5 rounded-sm"
                                                    style={{ background: ESTADO_COLOR[entry.estado] }}
                                                />
                                                {entry.name}
                                            </span>
                                            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                                                {entry.value}
                                                <span className="ml-1.5 font-normal text-slate-400">
                                                    {((entry.value / analytics.totalLicitaciones) * 100).toFixed(0)}%
                                                </span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Riesgos distribution — ordinal severity with direct labels */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <AlertTriangle size={18} className="text-warning-dark dark:text-warning" />
                            Distribución de Riesgos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {riesgosTotal === 0 ? (
                            <p className="py-12 text-center text-sm text-slate-400">Sin riesgos registrados.</p>
                        ) : (
                            <div className="space-y-3">
                                {RIESGO_ORDER.filter((nivel) => analytics.distribucionRiesgos[nivel] > 0).map(
                                    (nivel) => {
                                        const count = analytics.distribucionRiesgos[nivel];
                                        const pct = (count / riesgosTotal) * 100;
                                        return (
                                            <div key={nivel}>
                                                <div className="mb-1 flex items-center justify-between text-sm">
                                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                                        {nivel}
                                                    </span>
                                                    <span className="tabular-nums text-slate-500 dark:text-slate-400">
                                                        {count} ({pct.toFixed(1)}%)
                                                    </span>
                                                </div>
                                                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                                                    <div
                                                        className="h-2 rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${pct}%`,
                                                            background: RIESGO_COLOR[nivel],
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    }
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Monthly evolution — single series, the title names it */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp size={18} className="text-brand-600 dark:text-brand-400" />
                        Evolución mensual de análisis
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {evolutionData.length < 2 ? (
                        <p className="py-12 text-center text-sm text-slate-400">
                            Aún no hay historial suficiente para mostrar la evolución (se necesita más de un mes).
                        </p>
                    ) : (
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={evolutionData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="vizAreaFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="var(--viz-indigo)" stopOpacity={0.28} />
                                            <stop offset="100%" stopColor="var(--viz-indigo)" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid stroke="var(--viz-grid)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fill: 'var(--viz-ink)', fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={{ stroke: 'var(--viz-grid)' }}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        tick={{ fill: 'var(--viz-ink)', fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={tooltipStyle}
                                        formatter={(value) => [String(value), 'Análisis']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="count"
                                        stroke="var(--viz-indigo)"
                                        strokeWidth={2}
                                        fill="url(#vizAreaFill)"
                                        activeDot={{ r: 4 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
