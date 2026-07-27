import { useMemo, useState } from 'react';
import { Calculator, AlertTriangle, Info } from 'lucide-react';
import { PliegoVM } from '../../model/pliego-vm';
import { unwrap } from '../../../../lib/tracked-field';
import {
    parsePriceFormula,
    parseAnomalyThreshold,
    scorePrice,
    anomalyLimit,
    type PriceFormula,
} from '../../../../lib/scoring';

/**
 * Escenarios de oferta ganadora, como porcentaje de la oferta propia.
 *
 * El licitador no conoce la oferta más baja de sus rivales cuando decide su
 * precio, así que un número único sería falsa precisión. Se enseña qué pasa si
 * alguien baja un 5, un 10 o un 15 % por debajo.
 */
const RIVAL_SCENARIOS = [
    { label: 'Nadie baja de ti', factor: 1 },
    { label: 'Alguien baja un 5 %', factor: 0.95 },
    { label: 'Alguien baja un 10 %', factor: 0.9 },
    { label: 'Alguien baja un 15 %', factor: 0.85 },
];

function formatMoney(value: number, currency: string): string {
    try {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
    } catch {
        return `${Math.round(value).toLocaleString('es-ES')} ${currency}`;
    }
}

function Panel({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-center w-6 h-6 rounded bg-brand-50 dark:bg-brand-950">
                    <Calculator className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    Simulador de oferta económica
                </h3>
            </div>
            {children}
        </div>
    );
}

/** Aviso de que no se puede simular, con el motivo concreto. */
function NotSimulable({ reason }: { reason: string }) {
    return (
        <div className="px-5 py-6 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {reason} Comprueba el criterio económico en el pliego antes de fijar precio.
            </p>
        </div>
    );
}

export function PriceSimulator({ vm }: { vm: PliegoVM }) {
    const { objetivos, umbralAnormalidad } = vm.result.criteriosAdjudicacion;
    const dg = vm.result.datosGenerales as Record<string, unknown>;
    const budget = unwrap<number>(dg.presupuesto, 0) || null;
    const currency = unwrap<string>(dg.moneda, 'EUR') || 'EUR';

    // Se toma el primer criterio objetivo cuya fórmula sea interpretable: el
    // precio es casi siempre el primero, y los demás objetivos (plazo, mejoras)
    // no tienen fórmula de precio.
    const priceCriterion = useMemo(() => {
        for (const criterio of objetivos) {
            const parsed = parsePriceFormula(criterio.formula);
            if (parsed.ok) return { criterio, formula: parsed.formula as PriceFormula };
        }
        return null;
    }, [objetivos]);

    const firstReason = useMemo(() => {
        if (objetivos.length === 0) return 'El pliego no recoge criterios objetivos con fórmula.';
        const parsed = parsePriceFormula(objetivos[0]?.formula);
        return parsed.ok ? '' : parsed.reason;
    }, [objetivos]);

    const [bidText, setBidText] = useState('');
    const bid = Number.parseFloat(bidText.replace(/\./g, '').replace(',', '.'));
    const hasBid = Number.isFinite(bid) && bid > 0;

    const threshold = parseAnomalyThreshold(umbralAnormalidad);
    const anomalyFloor = threshold.ok ? anomalyLimit(threshold.threshold, { budget }) : null;
    const isRisky = hasBid && anomalyFloor !== null && bid < anomalyFloor;

    if (!priceCriterion) {
        return (
            <Panel>
                <NotSimulable reason={firstReason} />
            </Panel>
        );
    }

    const { criterio, formula } = priceCriterion;

    return (
        <Panel>
            <div className="p-5 space-y-4">
                <div>
                    <label
                        htmlFor="price-simulator-bid"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                        Tu oferta ({currency})
                    </label>
                    <input
                        id="price-simulator-bid"
                        type="text"
                        inputMode="decimal"
                        value={bidText}
                        onChange={(event) => setBidText(event.target.value)}
                        placeholder={budget ? String(Math.round(budget * 0.9)) : 'Importe sin IVA'}
                        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Criterio: {criterio.descripcion} · hasta {formula.maxPoints} puntos
                    </p>
                </div>

                {isRisky && (
                    <div
                        role="alert"
                        className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2"
                    >
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                            Riesgo de baja temeraria: por debajo de{' '}
                            <strong>{formatMoney(anomalyFloor as number, currency)}</strong> tendrías que justificar la
                            oferta.
                        </p>
                    </div>
                )}

                {hasBid ? (
                    <div>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                            Puntos según lo que haga la competencia
                        </p>
                        <ul className="space-y-1.5">
                            {RIVAL_SCENARIOS.map((scenario) => {
                                const points = scorePrice(formula, {
                                    bid,
                                    bestRivalBid: bid * scenario.factor,
                                    budget,
                                });
                                return (
                                    <li key={scenario.label} className="flex items-center justify-between gap-3">
                                        <span className="text-xs text-slate-600 dark:text-slate-400">
                                            {scenario.label}
                                        </span>
                                        <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">
                                            {points === null ? '—' : `${points} pts`}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Introduce un importe para ver cuántos puntos obtendrías en cada escenario.
                    </p>
                )}

                {threshold.ok && anomalyFloor === null && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        El umbral de baja temeraria se calcula sobre la media de las ofertas, que no se conoce hasta la
                        apertura de plicas.
                    </p>
                )}
            </div>
        </Panel>
    );
}
