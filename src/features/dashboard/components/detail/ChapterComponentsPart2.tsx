import { PliegoVM } from '../../model/pliego-vm';
import { Badge } from '../../../../components/ui/Badge';
import { AlertCircle, AlertTriangle, Check, FileJson, Copy, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../components/ui/Dialog';
import { Button } from '../../../../components/ui/Button';
import { EvidenceToggle } from './EvidenceToggle';
import { FeedbackToggle } from './FeedbackToggle';

// Reusing helper
function EmptyChapter({ title, text }: { title: string; text: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <AlertCircle className="w-8 h-8 text-slate-300 mb-3" />
            <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">{text}</p>
        </div>
    );
}

export function ChapterTecnicos({ vm }: { vm: PliegoVM }) {
    const { funcionales, normativa } = vm.result.requisitosTecnicos;
    const status = vm.chapters.find(c => c.id === 'tecnicos');

    if (status?.status === 'VACIO' && status.emptyMessage) {
        return <section id="tecnicos" className="py-8"><EmptyChapter title={status.emptyMessage.title} text={status.emptyMessage.text} /></section>;
    }

    return (
        <section id="tecnicos" className="py-8 scroll-mt-32">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 mb-8">Requisitos Técnicos</h2>

            <div className="grid gap-6">
                {funcionales.length > 0 && (
                    <div className="bg-white p-6 rounded-2xl border border-neutral-200/60 shadow-sm">
                        <h3 className="font-semibold text-slate-900 mb-4">Funcionales</h3>
                        <ul className="space-y-3">
                            {funcionales.map((req, i) => {
                                const text = typeof req === 'string' ? req : req.requisito;
                                const required = typeof req === 'object' ? req.obligatorio : true;
                                return (
                                    <li key={i} className={`flex gap-3 text-sm group items-start p-1 rounded ${vm.isAmbiguous(`result.requisitosTecnicos.funcionales[${i}]`) ? 'bg-orange-50' : ''}`}>
                                        {required ? (
                                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5"><span className="w-1.5 h-1.5 bg-slate-600 rounded-full" /></div>
                                        ) : (
                                            <div className="w-5 h-5 rounded-full border border-slate-200 flex items-center justify-center shrink-0 mt-0.5"><span className="text-[10px] text-slate-400">op</span></div>
                                        )}
                                        <span className="text-slate-700 flex-1">
                                            {text}
                                            {vm.isAmbiguous(`result.requisitosTecnicos.funcionales[${i}]`) && <AlertTriangle className="inline w-3 h-3 text-orange-500 ml-2" />}
                                        </span>
                                        <EvidenceToggle evidence={vm.getEvidence(`result.requisitosTecnicos.funcionales[${i}]`)} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <FeedbackToggle fieldPath={`result.requisitosTecnicos.funcionales[${i}]`} value={text as string} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {normativa.length > 0 && (
                    <div className="bg-white p-6 rounded-2xl border border-neutral-200/60 shadow-sm">
                        <h3 className="font-semibold text-slate-900 mb-4">Normativa y Estándares</h3>
                        <ul className="space-y-2">
                            {normativa.map((req, i) => {
                                const text = typeof req === 'string' ? req : req.norma;
                                return (
                                    <li key={i} className={`flex items-center gap-2 text-sm text-slate-600 group p-1 rounded ${vm.isAmbiguous(`result.requisitosTecnicos.normativa[${i}]`) ? 'bg-orange-50' : ''}`}>
                                        <Check className="w-4 h-4 text-green-500" />
                                        <span className="flex-1">
                                            {text}
                                            {vm.isAmbiguous(`result.requisitosTecnicos.normativa[${i}]`) && <AlertTriangle className="inline w-3 h-3 text-orange-500 ml-2" />}
                                        </span>
                                        <EvidenceToggle evidence={vm.getEvidence(`result.requisitosTecnicos.normativa[${i}]`)} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <FeedbackToggle fieldPath={`result.requisitosTecnicos.normativa[${i}]`} value={text as string} className="opacity-0 group-hover:opacity-100 transition-opacity" />
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

export function ChapterRiesgos({ vm }: { vm: PliegoVM }) {
    const { riesgos, killCriteria } = vm.result.restriccionesYRiesgos;
    const status = vm.chapters.find(c => c.id === 'riesgos');

    if (status?.status === 'VACIO' && status.emptyMessage) {
        return <section id="riesgos" className="py-8"><EmptyChapter title={status.emptyMessage.title} text={status.emptyMessage.text} /></section>;
    }

    return (
        <section id="riesgos" className="py-8 scroll-mt-32">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 mb-8 flex items-center gap-3">
                Riesgos y Restricciones
                {riesgos.some(r => r.impacto === 'CRITICO') && <Badge variant="destructive">Críticos detectados</Badge>}
            </h2>

            <div className="space-y-6">
                {killCriteria.length > 0 && (
                    <div className="bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm">
                        <h3 className="font-bold text-red-900 mb-4 flex items-center gap-2">
                            <XCircle className="w-5 h-5" />
                            Kill Criteria (Exclusiones)
                        </h3>
                        <ul className="space-y-4">
                            {killCriteria.map((k, i) => {
                                const text = typeof k === 'string' ? k : k.criterio;
                                const just = typeof k === 'object' ? k.justificacion : null;
                                return (
                                    <li key={i} className="text-red-800 text-sm group relative pr-8">
                                        <div className="absolute top-0 right-0">
                                            <EvidenceToggle evidence={vm.getEvidence(`result.restriccionesYRiesgos.killCriteria[${i}]`)} />
                                            <FeedbackToggle fieldPath={`result.restriccionesYRiesgos.killCriteria[${i}]`} value={text as string} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <p className="font-semibold">{text}</p>
                                        {just && <p className="mt-1 opacity-90">{just}</p>}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                <div className="grid gap-4">
                    {riesgos.map((r, i) => (
                        <div key={i} className={`bg-white p-5 rounded-2xl border border-neutral-200/60 shadow-sm flex items-start gap-4 relative group ${vm.isAmbiguous(`result.restriccionesYRiesgos.riesgos[${i}]`) ? 'ring-2 ring-orange-200 bg-orange-50/30' : ''}`}>
                            <div className="absolute top-4 right-4">
                                <div className="flex gap-2">
                                    {vm.isAmbiguous(`result.restriccionesYRiesgos.riesgos[${i}]`) && (
                                        <div title="Dato ambiguo o contradictorio" className="text-orange-500"><AlertTriangle size={16} /></div>
                                    )}
                                    <EvidenceToggle evidence={vm.getEvidence(`result.restriccionesYRiesgos.riesgos[${i}]`)} />
                                    <FeedbackToggle fieldPath={`result.restriccionesYRiesgos.riesgos[${i}]`} value={r.descripcion} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </div>
                            <div className={`p-2 rounded-lg shrink-0 ${r.impacto === 'CRITICO' ? 'bg-red-100 text-red-600' :
                                r.impacto === 'ALTO' ? 'bg-orange-100 text-orange-600' :
                                    'bg-yellow-100 text-yellow-600'
                                }`}>
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div className="pr-8">
                                <h4 className="font-medium text-slate-900">{r.descripcion}</h4>
                                <div className="flex gap-2 mt-2">
                                    <Badge variant={
                                        r.impacto === 'CRITICO' ? 'destructive' :
                                            r.impacto === 'ALTO' ? 'warning' : 'secondary'
                                    } className="text-[10px] px-2 py-0 h-5">
                                        {r.impacto}
                                    </Badge>
                                </div>
                                {r.mitigacionSugerida && (
                                    <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded">
                                        <strong>Sugerencia:</strong> {r.mitigacionSugerida}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function ChapterServicio({ vm }: { vm: PliegoVM }) {
    const { sla, equipoMinimo } = vm.result.modeloServicio;
    const status = vm.chapters.find(c => c.id === 'servicio');

    if (status?.status === 'VACIO' && status.emptyMessage) {
        return <section id="servicio" className="py-8"><EmptyChapter title={status.emptyMessage.title} text={status.emptyMessage.text} /></section>;
    }

    return (
        <section id="servicio" className="py-8 scroll-mt-32">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 mb-8">Modelo de Servicio</h2>
            <div className="grid md:grid-cols-2 gap-6">
                {sla.length > 0 && (
                    <div className="bg-white p-6 rounded-2xl border border-neutral-200/60 shadow-sm">
                        <h3 className="font-semibold text-slate-900 mb-4">SLA (Niveles de Servicio)</h3>
                        <ul className="space-y-3">
                            {sla.map((s, i) => {
                                const metric = typeof s === 'string' ? s : s.metrica;
                                const target = typeof s === 'object' ? s.objetivo : null;
                                return (
                                    <li key={i} className="text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0 group relative">
                                        <div className="absolute top-0 right-0">
                                            <EvidenceToggle evidence={vm.getEvidence(`result.modeloServicio.sla[${i}]`)} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <FeedbackToggle fieldPath={`result.modeloServicio.sla[${i}]`} value={metric as string} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <p className="font-medium text-slate-700 pr-6">{metric}</p>
                                        {target && <p className="text-slate-500 text-xs">Objetivo: {target}</p>}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
                {equipoMinimo.length > 0 && (
                    <div className="bg-white p-6 rounded-2xl border border-neutral-200/60 shadow-sm">
                        <h3 className="font-semibold text-slate-900 mb-4">Equipo Mínimo</h3>
                        <ul className="space-y-3">
                            {equipoMinimo.map((e, i) => {
                                const role = typeof e === 'string' ? e : e.rol;
                                const exp = typeof e === 'object' ? `${e.experienciaAnios} años` : null;
                                return (
                                    <li key={i} className="flex justify-between items-center text-sm group">
                                        <span className="text-slate-700">{role}</span>
                                        <div className="flex items-center gap-2">
                                            {exp && <Badge variant="secondary" className="text-xs">{exp}</Badge>}
                                            <EvidenceToggle evidence={vm.getEvidence(`result.modeloServicio.equipoMinimo[${i}]`)} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <FeedbackToggle fieldPath={`result.modeloServicio.equipoMinimo[${i}]`} value={role as string} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
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


export function TechnicalJsonModal({ vm, isOpen, onClose }: { vm: PliegoVM; isOpen: boolean; onClose: () => void }) {
    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(vm.result, null, 2));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileJson className="w-5 h-5 text-slate-500" />
                        Datos Técnicos (JSON)
                    </DialogTitle>
                </DialogHeader>

                <div className="flex bg-slate-100 p-2 rounded-lg items-center gap-2 mb-2 text-xs text-slate-500">
                    <AlertCircle className="w-4 h-4" />
                    <span>Solo para depuración y soporte técnico. Esta es la estructura interna utilizada por el sistema.</span>
                </div>

                <div className="flex-1 overflow-auto bg-slate-950 text-slate-50 p-4 rounded-lg font-mono text-xs shadow-inner">
                    <pre>{JSON.stringify(vm.result, null, 2)}</pre>
                </div>

                <div className="flex justify-end pt-4">
                    <Button variant="outline" onClick={handleCopy} className="gap-2">
                        <Copy className="w-4 h-4" /> Copiar JSON
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
