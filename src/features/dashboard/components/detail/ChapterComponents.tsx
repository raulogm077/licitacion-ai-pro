
import { PliegoVM } from '../../model/pliego-vm';
import { Card } from '../../../../components/ui/Card';
import { Badge } from '../../../../components/ui/Badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { EvidenceToggle } from './EvidenceToggle';

interface ChapterProps {
    vm: PliegoVM;
    onReanalyze?: () => void;
    onOpenDrawer?: () => void;
}

// ... empty chapter ...

export function ChapterSummary({ vm, onReanalyze, onOpenDrawer }: ChapterProps) {
    // ... existing ... (no changes needed here as it uses kpi tiles)
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
    const status = vm.chapters.find(c => c.id === 'datos');

    if (status?.status === 'VACIO' && status.emptyMessage) {
        return <section id="datos" className="py-8"><EmptyChapter title={status.emptyMessage.title} text={status.emptyMessage.text} /></section>;
    }

    return (
        <section id="datos" className="py-8 scroll-mt-32">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 mb-8">Datos Generales</h2>

            <Card className="rounded-2xl border-neutral-200/60 shadow-sm overflow-hidden">
                <div className="divide-y divide-neutral-100">
                    <Row label="Título" value={vm.display.titulo} evidence={vm.getEvidence('result.datosGenerales.titulo')} isAmbiguous={vm.isAmbiguous('result.datosGenerales.titulo')} />
                    <Row label="Órgano de Contratación" value={vm.display.organo} evidence={vm.getEvidence('result.datosGenerales.organoContratacion')} isAmbiguous={vm.isAmbiguous('result.datosGenerales.organoContratacion')} />
                    <Row label="Presupuesto Base" value={vm.display.presupuesto} evidence={vm.getEvidence('result.datosGenerales.presupuesto')} isAmbiguous={vm.isAmbiguous('result.datosGenerales.presupuesto')} />
                    <Row label="Plazo de Ejecución" value={vm.display.plazo} evidence={vm.getEvidence('result.datosGenerales.plazoEjecucionMeses')} isAmbiguous={vm.isAmbiguous('result.datosGenerales.plazoEjecucionMeses')} />
                    <Row label="CPV" value={vm.display.cpv} evidence={vm.getEvidence('result.datosGenerales.cpv')} isAmbiguous={vm.isAmbiguous('result.datosGenerales.cpv')} />
                    {general.fechaLimitePresentacion && (
                        <Row label="Fecha Límite" value={general.fechaLimitePresentacion} />
                    )}
                </div>
            </Card>
        </section>
    );
}

function Row({ label, value, evidence, isAmbiguous }: { label: string; value: string; evidence?: { quote: string; pageHint?: string }, isAmbiguous?: boolean }) {
    const isNotDetected = value === 'No detectado';
    return (
        <div className={`flex flex-col sm:flex-row sm:items-baseline justify-between p-5 hover:bg-slate-50/50 transition-colors gap-2 group relative ${isAmbiguous ? 'bg-orange-50/50' : ''}`}>
            <div className="flex items-center gap-2 w-1/3">
                <span className="text-sm font-medium text-slate-500">{label}</span>
                {isAmbiguous && (
                    <div title="Dato ambiguo o contradictorio" className="text-orange-500">
                        <AlertCircle size={14} />
                    </div>
                )}
                <EvidenceToggle evidence={evidence} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
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
                                <div key={i} className="bg-white p-5 rounded-2xl border border-neutral-200/60 shadow-sm relative group">
                                    <div className="absolute top-4 right-4">
                                        <EvidenceToggle evidence={vm.getEvidence(`result.criteriosAdjudicacion.objetivos[${i}]`)} />
                                    </div>
                                    <div className="flex justify-between items-start gap-4 pr-8">
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
                                <div key={i} className="bg-white p-5 rounded-2xl border border-neutral-200/60 shadow-sm relative group">
                                    <div className="absolute top-4 right-4">
                                        <EvidenceToggle evidence={vm.getEvidence(`result.criteriosAdjudicacion.subjetivos[${i}]`)} />
                                    </div>
                                    <div className="flex justify-between items-start gap-4 pr-8">
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
                    <div className="bg-white p-6 rounded-2xl border border-neutral-200/60 shadow-sm relative group">
                        <div className="absolute top-6 right-6">
                            <EvidenceToggle evidence={vm.getEvidence('result.requisitosSolvencia.economica.cifraNegocioAnualMinima')} />
                        </div>
                        <h3 className="font-semibold text-slate-900 mb-4">Solvencia Económica</h3>
                        <div className="space-y-4 pr-8">
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
                                const desc = typeof req === 'string' ? req : req.descripcion;
                                return (
                                    <li key={i} className="flex gap-3 text-sm text-slate-700 group items-start">
                                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                                        <span className="flex-1">{desc as React.ReactNode}</span>
                                        <EvidenceToggle evidence={vm.getEvidence(`result.requisitosSolvencia.tecnica[${i}]`)} className="opacity-0 group-hover:opacity-100 transition-opacity" />
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

function EmptyChapter({ title, text }: { title?: string; text?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <AlertCircle className="w-8 h-8 text-slate-300 mb-3" />
            <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">{text}</p>
        </div>
    );
}

function jsonHasContent(val: unknown) {
    return !!(val && val !== 'No detectado' && val !== '');
}
