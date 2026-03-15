import { Badge } from '../../../components/ui/Badge';

interface Riesgo {
    descripcion: string;
    impacto: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO';
}

interface RisksSlideProps {
    riesgos: Riesgo[];
}

export function RisksSlide({ riesgos }: RisksSlideProps) {
    if (!riesgos || riesgos.length === 0) {
        return null;
    }

    return (
        <section>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">
                Riesgos Identificados
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {riesgos.slice(0, 6).map((riesgo, idx) => {
                    const colors = {
                        CRITICO: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-500',
                        ALTO: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-500',
                        MEDIO: 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-500',
                        BAJO: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-500',
                    };

                    return (
                        <div key={idx} className={`p-4 bg-gradient-to-br ${colors[riesgo.impacto]} border-l-4 rounded-lg`}>
                            <Badge variant={riesgo.impacto === 'CRITICO' || riesgo.impacto === 'ALTO' ? 'danger' : 'warning'} className="mb-2">
                                {riesgo.impacto}
                            </Badge>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                {riesgo.descripcion}
                            </p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
