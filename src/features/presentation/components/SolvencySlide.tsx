import { formatCurrency } from '../../../lib/formatters';

interface SolvenciaTecnica {
    descripcion: string;
    proyectosSimilaresRequeridos?: number;
}

interface SolvencySlideProps {
    economica: {
        cifraNegocioAnualMinima: number;
    };
    tecnica: SolvenciaTecnica[];
    moneda?: string;
}

export function SolvencySlide({ economica, tecnica, moneda = 'EUR' }: SolvencySlideProps) {
    return (
        <section>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">
                Requisitos de Solvencia
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Económica */}
                <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl">
                    <h3 className="text-xl font-semibold text-amber-900 dark:text-amber-100 mb-4">
                        Solvencia Económica
                    </h3>
                    <p className="text-3xl font-bold text-amber-800 dark:text-amber-200">
                        {formatCurrency(economica.cifraNegocioAnualMinima, moneda)}
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                        Cifra de negocio anual mínima
                    </p>
                </div>

                {/* Técnica */}
                <div className="p-6 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-2xl">
                    <h3 className="text-xl font-semibold text-teal-900 dark:text-teal-100 mb-4">
                        Solvencia Técnica
                    </h3>
                    <div className="space-y-3">
                        {tecnica.map((req, idx) => (
                            <div key={idx} className="text-sm">
                                <p className="font-medium text-teal-800 dark:text-teal-200">
                                    {req.descripcion}
                                </p>
                                {req.proyectosSimilaresRequeridos !== undefined && (
                                    <p className="text-teal-700 dark:text-teal-300">
                                        {req.proyectosSimilaresRequeridos} proyectos similares requeridos
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
