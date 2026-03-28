import { LicitacionData } from '../../types';
import { unwrap } from '../../lib/tracked-field';
import { X, Maximize2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';

interface PresentationModeProps {
    data: LicitacionData;
    onClose: () => void;
}

export function PresentationMode({ data, onClose }: PresentationModeProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: unwrap(data.datosGenerales.moneda),
        }).format(amount);
    };

    return (
        <div className="fixed inset-0 bg-white dark:bg-slate-900 z-50 overflow-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 z-10">
                <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Maximize2 size={20} className="text-brand-600" />
                        <span className="font-semibold text-slate-900 dark:text-white">Modo Presentación</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Salir del modo presentación"
                    >
                        <X size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-8 py-12 space-y-12">
                {/* Title Slide */}
                <section className="text-center py-20">
                    <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-6">
                        {unwrap(data.datosGenerales.titulo)}
                    </h1>
                    <div className="flex flex-wrap justify-center gap-3">
                        {data.metadata?.tags &&
                            data.metadata.tags.map((tag, idx) => (
                                <Badge key={idx} variant="default" className="text-sm px-4 py-2">
                                    {tag}
                                </Badge>
                            ))}
                    </div>
                </section>

                {/* Key Info */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="text-center p-8 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-800/20 rounded-2xl">
                        <p className="text-sm font-medium text-brand-700 dark:text-brand-300 mb-2 uppercase tracking-wide">
                            Presupuesto
                        </p>
                        <p className="text-4xl font-bold text-brand-900 dark:text-brand-100">
                            {formatCurrency(unwrap(data.datosGenerales.presupuesto))}
                        </p>
                    </div>

                    <div className="text-center p-8 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl">
                        <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2 uppercase tracking-wide">
                            Plazo
                        </p>
                        <p className="text-4xl font-bold text-purple-900 dark:text-purple-100">
                            {unwrap(data.datosGenerales.plazoEjecucionMeses)}
                            <span className="text-2xl ml-2">meses</span>
                        </p>
                    </div>

                    <div className="text-center p-8 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-2xl">
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2 uppercase tracking-wide">
                            Estado
                        </p>
                        <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                            {data.metadata?.estado || 'PENDIENTE'}
                        </p>
                    </div>
                </section>

                {/* Criterios */}
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
                            {data.criteriosAdjudicacion.subjetivos.map((criterio, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 bg-white dark:bg-slate-800 border-l-4 border-blue-500 rounded-lg shadow-sm"
                                >
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
                            {data.criteriosAdjudicacion.objetivos.map((criterio, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 bg-white dark:bg-slate-800 border-l-4 border-green-500 rounded-lg shadow-sm"
                                >
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

                {/* Solvencia */}
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
                                {formatCurrency(data.requisitosSolvencia.economica.cifraNegocioAnualMinima)}
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
                                {data.requisitosSolvencia.tecnica.map((req, idx) => (
                                    <div key={idx} className="text-sm">
                                        <p className="font-medium text-teal-800 dark:text-teal-200">
                                            {req.descripcion}
                                        </p>
                                        <p className="text-teal-700 dark:text-teal-300">
                                            {req.proyectosSimilaresRequeridos} proyectos similares requeridos
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Riesgos (if any) */}
                {data.restriccionesYRiesgos.riesgos.length > 0 && (
                    <section>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">
                            Riesgos Identificados
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {data.restriccionesYRiesgos.riesgos.slice(0, 6).map((riesgo, idx) => {
                                const colors = {
                                    CRITICO:
                                        'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-500',
                                    ALTO: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-500',
                                    MEDIO: 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-500',
                                    BAJO: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-500',
                                };

                                return (
                                    <div
                                        key={idx}
                                        className={`p-4 bg-gradient-to-br ${colors[riesgo.impacto]} border-l-4 rounded-lg`}
                                    >
                                        <Badge
                                            variant={
                                                riesgo.impacto === 'CRITICO' || riesgo.impacto === 'ALTO'
                                                    ? 'danger'
                                                    : 'warning'
                                            }
                                            className="mb-2"
                                        >
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
                )}
            </div>
        </div>
    );
}
