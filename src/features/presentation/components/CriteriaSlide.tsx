import { Badge } from '../../../components/ui/Badge';

interface CriterioSubjetivo {
    descripcion: string;
    ponderacion: number;
    detalles?: string;
}

interface CriterioObjetivo {
    descripcion: string;
    ponderacion: number;
    formula?: string;
}

interface CriteriaSlideProps {
    subjetivos: CriterioSubjetivo[];
    objetivos: CriterioObjetivo[];
}

export function CriteriaSlide({ subjetivos, objetivos }: CriteriaSlideProps) {
    return (
        <section>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">
                Criterios de Adjudicación
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Subjetivos */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-4">
                        Criterios Subjetivos
                    </h3>
                    {subjetivos.map((criterio, idx) => (
                        <div key={idx} className="p-4 bg-white dark:bg-slate-800 border-l-4 border-blue-500 rounded-lg shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                                <p className="font-medium text-slate-900 dark:text-white flex-1">
                                    {criterio.descripcion}
                                </p>
                                <Badge variant="default" className="ml-2 shrink-0 text-lg px-3">
                                    {criterio.ponderacion}%
                                </Badge>
                            </div>
                            {criterio.detalles && (
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                                    {criterio.detalles}
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Objetivos */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-4">
                        Criterios Objetivos
                    </h3>
                    {objetivos.map((criterio, idx) => (
                        <div key={idx} className="p-4 bg-white dark:bg-slate-800 border-l-4 border-green-500 rounded-lg shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                                <p className="font-medium text-slate-900 dark:text-white flex-1">
                                    {criterio.descripcion}
                                </p>
                                <Badge variant="default" className="ml-2 shrink-0 text-lg px-3">
                                    {criterio.ponderacion}%
                                </Badge>
                            </div>
                            {criterio.formula && (
                                <p className="text-sm font-mono text-slate-600 dark:text-slate-400 mt-2 bg-slate-50 dark:bg-slate-900 p-2 rounded">
                                    {criterio.formula}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
