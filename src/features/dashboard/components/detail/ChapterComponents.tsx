import { PliegoVM } from '../../model/pliego-vm';
import { Card } from '../../../../components/ui/Card';
import { Badge } from '../../../../components/ui/Badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ChapterProps {
    vm: PliegoVM;
    onReanalyze?: () => void;
    onOpenDrawer?: () => void;
}

// Helper for "Empty State" within a chapter
function EmptyChapter({ title, text }: { title: string; text: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <AlertCircle className="w-8 h-8 text-slate-300 mb-3" />
            <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">{text}</p>
        </div>
    );
}

export function ChapterSummary({ vm, onReanalyze, onOpenDrawer }: ChapterProps) {
    return (
        <section id="resumen" className="space-y-6">
            {vm.isAnalysisEmpty && (
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 flex flex-col sm:flex-row gap-4 items-start">
                    <div className="p-2 bg-orange-100 rounded-lg text-orange-600 shrink-0">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-orange-900 mb-1">Análisis incompleto</h3>
                        <p className="text-sm text-orange-800/80 leading-relaxed mb-4">
                            No se han podido extraer datos clave del pliego. Es posible que el PDF no tenga texto seleccionable o que el contenido relevante no haya sido detectado.
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
                                className="text-sm font-medium text-orange-700 hover:bg-orange-100 px-4 py-2 rounded-lg transition"
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
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/60 shadow-sm flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-neutral-500 font-medium">{label}</span>
            <span className={`text-lg font-semibold leading-tight ${isNotDetected ? 'text-neutral-400 italic text-base' : highlight ? 'text-orange-600' : 'text-neutral-900'}`}>
                {value}
            </span>
        </div>
    );
}

export function ChapterDatos({ vm }: ChapterProps) {
    const general = vm.result.datosGenerales;
    const status = vm.chapters.find(c => c.id === 'datos'); // Should verify if empty

    // Check critical fields manually if needed or adhere to VM status
    // const isCriticalMissing = vm.warnings.some(w => w.severity === 'CRITICO');

    if (status?.status === 'VACIO' && status.emptyMessage) {
        return <section id="datos" className="py-8"><EmptyChapter title={status.emptyMessage.title} text={status.emptyMessage.text} /></section>;
    }

    return (
        <section id="datos" className="py-8 scroll-mt-32">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 mb-8">Datos Generales</h2>

            <Card className="rounded-2xl border-neutral-200/60 shadow-sm overflow-hidden">
                <div className="divide-y divide-neutral-100">
                    <Row label="Título" value={vm.display.titulo} />
                    <Row label="Órgano de Contratación" value={vm.display.organo} />
                    <Row label="Presupuesto Base" value={vm.display.presupuesto} />
                    <Row label="Plazo de Ejecución" value={vm.display.plazo} />
                    <Row label="CPV" value={vm.display.cpv} />
                    {general.fechaLimitePresentacion && (
                        <Row label="Fecha Límite" value={general.fechaLimitePresentacion} />
                    )}
                </div>
            </Card>
        </section>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    const isNotDetected = value === 'No detectado';
    return (
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between p-5 hover:bg-slate-50/50 transition-colors gap-2">
            <span className="text-sm font-medium text-slate-500 w-1/3">{label}</span>
            <span className={`text-sm font-medium text-slate-900 sm:text-right flex-1 ${isNotDetected ? 'italic text-slate-400' : ''}`}>
                {value}
            </span>
        </div>
    );
}

export function ChapterCriterios({ vm }: ChapterProps) {
    const { objetivos, subjetivos } = vm.result.criteriosAdjudicacion;
    const status = vm.chapters.find(c => c.id === 'criterios');

    if (status?.status === 'VACIO' && status.emptyMessage) {
        return <section id="criterios" className="py-8"><EmptyChapter title={status.emptyMessage.title} text={status.emptyMessage.text} /></section>;
    }

    return (
        <section id="criterios" className="py-8 scroll-mt-32">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Criterios</h2>
                <Badge variant="outline" className="text-sm font-normal px-3">
                    Total: {objetivos.length + subjetivos.length}
                </Badge>
            </div>

            <div className="space-y-8">
                {objetivos.length > 0 && (
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            Objetivos (Evaluables mediante fórmula)
                        </h3>
                        <div className="grid gap-4">
                            {objetivos.map((c, i) => (
                                <div key={i} className="bg-white p-5 rounded-2xl border border-neutral-200/60 shadow-sm">
                                    <div className="flex justify-between items-start gap-4">
                                        <div>
                                            <p className="font-medium text-slate-900 mb-1">{c.descripcion}</p>
                                            {c.formula && <p className="text-xs text-slate-500 font-mono bg-slate-50 p-1.5 rounded mt-2 block w-fit">{c.formula}</p>}
                                        </div>
                                        <Badge className="bg-blue-50 text-blue-700 border-blue-100 shrink-0">{c.ponderacion} pts</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {subjetivos.length > 0 && (
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                            Subjetivos (Juicio de valor)
                        </h3>
                        <div className="grid gap-4">
                            {subjetivos.map((c, i) => (
                                <div key={i} className="bg-white p-5 rounded-2xl border border-neutral-200/60 shadow-sm">
                                    <div className="flex justify-between items-start gap-4">
                                        <div>
                                            <p className="font-medium text-slate-900 mb-1">{c.descripcion}</p>
                                            {c.detalles && <p className="text-sm text-slate-500 mt-1">{c.detalles}</p>}
                                        </div>
                                        <Badge className="bg-purple-50 text-purple-700 border-purple-100 shrink-0">{c.ponderacion} pts</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

export function ChapterSolvencia({ vm }: ChapterProps) {
    const { economica, tecnica } = vm.result.requisitosSolvencia;
    const status = vm.chapters.find(c => c.id === 'solvencia');

    if (status?.status === 'VACIO' && status.emptyMessage) {
        return <section id="solvencia" className="py-8"><EmptyChapter title={status.emptyMessage.title} text={status.emptyMessage.text} /></section>;
    }

    return (
        <section id="solvencia" className="py-8 scroll-mt-32">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 mb-8">Solvencia</h2>

            <div className="grid gap-6">
                {(economica.cifraNegocioAnualMinima > 0 || jsonHasContent(economica.descripcion)) && (
                    <div className="bg-white p-6 rounded-2xl border border-neutral-200/60 shadow-sm">
                        <h3 className="font-semibold text-slate-900 mb-4">Solvencia Económica</h3>
                        <div className="space-y-4">
                            {economica.cifraNegocioAnualMinima > 0 && (
                                <div>
                                    <span className="text-xs text-slate-500 uppercase tracking-wide">Cifra de Negocio Mínima</span>
                                    <p className="text-xl font-medium text-slate-900 mt-1">
                                        {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(economica.cifraNegocioAnualMinima)}
                                    </p>
                                </div>
                            )}
                            {jsonHasContent(economica.descripcion) && (
                                <p className="text-sm text-slate-600">{economica.descripcion as React.ReactNode}</p>
                            )}
                        </div>
                    </div>
                )}

                {tecnica.length > 0 && (
                    <div className="bg-white p-6 rounded-2xl border border-neutral-200/60 shadow-sm">
                        <h3 className="font-semibold text-slate-900 mb-4">Solvencia Técnica</h3>
                        <ul className="space-y-4">
                            {tecnica.map((req, i) => {
                                // Polymorphic handling already done in schema? No, VM gets raw object/string from data.result.
                                // But data.result IS schema-compliant. 
                                // wait, schema normalization happens in Zod.
                                // LicitacionContent types "killCriteria" as string | object. Solvencia tecnica is string | object.
                                // We need to handle this here too.
                                const desc = typeof req === 'string' ? req : req.descripcion;
                                return (
                                    <li key={i} className="flex gap-3 text-sm text-slate-700">
                                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                        <span>{desc as React.ReactNode}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
}

function jsonHasContent(val: unknown) {
    return !!(val && val !== 'No detectado' && val !== '');
}
