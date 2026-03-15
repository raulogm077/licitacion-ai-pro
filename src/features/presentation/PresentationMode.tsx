import { LicitacionData } from '../../types';
import { X, Maximize2 } from 'lucide-react';
import { TitleSlide } from './components/TitleSlide';
import { KeyInfoSlide } from './components/KeyInfoSlide';
import { CriteriaSlide } from './components/CriteriaSlide';
import { SolvencySlide } from './components/SolvencySlide';
import { RisksSlide } from './components/RisksSlide';

interface PresentationModeProps {
    data: LicitacionData;
    onClose: () => void;
}

export function PresentationMode({ data, onClose }: PresentationModeProps) {
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
                <TitleSlide
                    titulo={data.datosGenerales.titulo}
                    tags={data.metadata?.tags}
                />

                <KeyInfoSlide
                    presupuesto={data.datosGenerales.presupuesto}
                    moneda={data.datosGenerales.moneda}
                    plazoEjecucionMeses={data.datosGenerales.plazoEjecucionMeses}
                    estado={data.metadata?.estado}
                />

                <CriteriaSlide
                    subjetivos={data.criteriosAdjudicacion.subjetivos}
                    objetivos={data.criteriosAdjudicacion.objetivos}
                />

                <SolvencySlide
                    economica={data.requisitosSolvencia.economica}
                    tecnica={data.requisitosSolvencia.tecnica}
                    moneda={data.datosGenerales.moneda}
                />

                {data.restriccionesYRiesgos.riesgos.length > 0 && (
                    <RisksSlide
                        riesgos={data.restriccionesYRiesgos.riesgos}
                    />
                )}
            </div>
        </div>
    );
}
