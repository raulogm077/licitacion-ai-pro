import { formatCurrency } from '../../../lib/formatters';

interface KeyInfoSlideProps {
    presupuesto: number;
    moneda: string;
    plazoEjecucionMeses: number;
    estado?: string;
}

export function KeyInfoSlide({
    presupuesto,
    moneda,
    plazoEjecucionMeses,
    estado = 'PENDIENTE'
}: KeyInfoSlideProps) {
    return (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-800/20 rounded-2xl">
                <p className="text-sm font-medium text-brand-700 dark:text-brand-300 mb-2 uppercase tracking-wide">
                    Presupuesto
                </p>
                <p className="text-4xl font-bold text-brand-900 dark:text-brand-100">
                    {formatCurrency(presupuesto, moneda)}
                </p>
            </div>

            <div className="text-center p-8 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl">
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2 uppercase tracking-wide">
                    Plazo
                </p>
                <p className="text-4xl font-bold text-purple-900 dark:text-purple-100">
                    {plazoEjecucionMeses}
                    <span className="text-2xl ml-2">meses</span>
                </p>
            </div>

            <div className="text-center p-8 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-2xl">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2 uppercase tracking-wide">
                    Estado
                </p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                    {estado}
                </p>
            </div>
        </section>
    );
}
