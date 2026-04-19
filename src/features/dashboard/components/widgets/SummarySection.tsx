import { Sparkles, MapPin, Users, Layers, Tag } from 'lucide-react';
import { unwrap } from '../../../../lib/tracked-field';
import { PliegoVM } from '../../model/pliego-vm';

export function SummarySection({ vm }: { vm: PliegoVM }) {
    const dg = vm.result.datosGenerales;
    const cpvs = unwrap(dg.cpv) || [];
    const mainCpv = cpvs.length > 0 ? cpvs.join(' · ') : 'No detectado';
    const procedimiento = (dg as Record<string, unknown>).procedimiento as string | undefined;
    const tipoContrato = (dg as Record<string, unknown>).tipoContrato as string | undefined;
    const summarySentences = buildSummarySentences(vm);
    const qualityChapters = vm.chapters.filter((chapter) => !['plantilla', 'resumen'].includes(chapter.id));

    const metadata = [
        {
            icon: MapPin,
            label: 'Órgano de Contratación',
            value: unwrap(dg.organoContratacion) || 'No detectado',
        },
        {
            icon: Layers,
            label: 'Procedimiento',
            value: procedimiento || 'No detectado',
        },
        {
            icon: Users,
            label: 'Clasificación CPV',
            value: mainCpv,
        },
        {
            icon: Tag,
            label: 'Tipo de Contrato',
            value: tipoContrato || 'No detectado',
        },
    ];
    const toneClass =
        vm.guidance?.tone === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : vm.guidance?.tone === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-cyan/20 bg-cyan/5 text-slate-700';

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-navy/10">
                        <Sparkles className="w-3.5 h-3.5 text-navy" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">Resumen Ejecutivo Autogenerado</h2>
                </div>
                <span className="inline-flex items-center border font-semibold text-cyan-muted border-cyan/40 bg-cyan/5 px-2 py-0.5 rounded text-[10px]">
                    Análisis IA · {vm.quality.overall}
                </span>
            </div>

            <div className="p-5 space-y-4">
                {vm.guidance && (
                    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
                        <p className="text-sm font-semibold">{vm.guidance.title}</p>
                        <p className="mt-1 text-sm leading-relaxed">{vm.guidance.description}</p>
                        <p className="mt-2 text-xs font-medium uppercase tracking-wide opacity-80">
                            Siguiente paso: {vm.guidance.nextStep}
                        </p>
                    </div>
                )}

                <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
                    {summarySentences.map((sentence) => (
                        <p key={sentence}>{sentence}</p>
                    ))}
                    {vm.warnings.length > 0 && !vm.isAnalysisEmpty && (
                        <p className="text-slate-500 italic text-xs border-l-2 border-cyan/50 pl-3">
                            Consulta el panel lateral para revisar alertas, huecos del expediente y secciones que
                            requieren validación manual.
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                    {qualityChapters.map((chapter) => (
                        <span
                            key={chapter.id}
                            className={`text-[11px] font-medium px-2 py-1 rounded border ${
                                chapter.status === 'COMPLETO'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : chapter.status === 'PARCIAL'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                        >
                            {chapter.label}: {chapter.status}
                        </span>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-4 border-t border-slate-100">
                    {metadata.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-start gap-2.5">
                            <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-0.5">
                                    {label}
                                </p>
                                <p className="text-xs font-medium text-slate-900 leading-snug truncate" title={value}>
                                    {value}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function buildSummarySentences(vm: PliegoVM) {
    const dg = vm.result.datosGenerales;
    const titulo = unwrap(dg.titulo) || '';
    const organo = unwrap(dg.organoContratacion) || '';
    const sentences: string[] = [];

    if (titulo || organo) {
        sentences.push(
            [
                titulo ? `Se ha identificado el expediente "${titulo}"` : 'Se ha identificado un expediente',
                organo ? `promovido por ${organo}` : null,
            ]
                .filter(Boolean)
                .join(' ')
                .concat('.')
        );
    }

    if (vm.display.presupuesto !== 'No detectado' || vm.display.plazo !== 'No detectado') {
        const parts = [];
        if (vm.display.presupuesto !== 'No detectado') {
            parts.push(`presupuesto ${vm.display.presupuesto}`);
        }
        if (vm.display.plazo !== 'No detectado') {
            parts.push(`plazo ${vm.display.plazo}`);
        }
        sentences.push(`Entre los datos contractuales recuperados figuran ${parts.join(' y ')}.`);
    }

    if (vm.counts.criterios > 0 || vm.counts.requerimientos > 0 || vm.counts.riesgos > 0) {
        const highlights = [];
        if (vm.counts.criterios > 0) highlights.push(`${vm.counts.criterios} criterios`);
        if (vm.counts.requerimientos > 0) highlights.push(`${vm.counts.requerimientos} requisitos técnicos`);
        if (vm.counts.riesgos > 0) highlights.push(`${vm.counts.riesgos} riesgos o exclusiones`);
        sentences.push(`La extracción ha recuperado ${highlights.join(', ')} con trazabilidad a citas del documento.`);
    }

    if (sentences.length === 0) {
        sentences.push(
            'El sistema ha podido procesar el PDF, pero el resultado recuperado es demasiado limitado para construir un resumen fiable sin apoyo documental adicional.'
        );
    }

    return sentences;
}
