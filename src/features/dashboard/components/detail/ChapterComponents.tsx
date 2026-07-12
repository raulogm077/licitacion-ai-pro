import { PliegoVM } from '../../model/pliego-vm';
import { AlertCircle } from 'lucide-react';

interface ChapterProps {
    vm: PliegoVM;
    onReanalyze?: () => void;
    onOpenDrawer?: () => void;
}

export function ChapterSummary({ vm, onReanalyze, onOpenDrawer }: ChapterProps) {
    return (
        <section id="resumen" className="space-y-6">
            {vm.isAnalysisEmpty && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/50 rounded-2xl p-6 flex flex-col sm:flex-row gap-4 items-start">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400 shrink-0">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-300 mb-1">
                            Análisis incompleto
                        </h3>
                        <p className="text-sm text-orange-800/80 dark:text-orange-200/80 leading-relaxed mb-4">
                            No se han podido extraer datos clave del pliego. Es posible que el PDF no tenga texto
                            seleccionable o que el contenido relevante no haya sido detectado.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={onReanalyze}
                                className="text-sm font-semibold bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition"
                            >
                                Re-analizar
                            </button>
                            <button
                                onClick={onOpenDrawer}
                                className="text-sm font-medium text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30 px-4 py-2 rounded-lg transition"
                            >
                                Ver avisos
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiTile label="Presupuesto" value={vm.display.presupuesto} />
                <KpiTile label="Plazo" value={vm.display.plazo} />
                <KpiTile label="CPV" value={vm.display.cpv} />
                <KpiTile label="Riesgos" value={vm.counts.riesgos.toString()} highlight={vm.counts.riesgos > 0} />
            </div>
        </section>
    );
}

function KpiTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    const isNotDetected = value === 'No detectado';
    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-neutral-200/60 dark:border-slate-700 shadow-sm flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-neutral-500 dark:text-slate-400 font-medium">
                {label}
            </span>
            <span
                className={`text-lg font-semibold leading-tight ${isNotDetected ? 'text-neutral-400 dark:text-slate-500 italic text-base' : highlight ? 'text-orange-600 dark:text-orange-400' : 'text-neutral-900 dark:text-white'}`}
            >
                {value}
            </span>
        </div>
    );
}
