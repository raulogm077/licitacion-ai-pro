import { Sparkles, MapPin, Users, Layers, Tag } from 'lucide-react';
import { unwrap } from '../../../../lib/tracked-field';
import { PliegoVM } from '../../model/pliego-vm';

export function SummarySection({ vm }: { vm: PliegoVM }) {
    const dg = vm.result.datosGenerales;
    const cpvs = unwrap(dg.cpv) || [];
    const mainCpv = cpvs.length > 0 ? cpvs.join(' · ') : 'No especificado';

    const metadata = [
        {
            icon: MapPin,
            label: 'Órgano de Contratación',
            value: unwrap(dg.organoContratacion) || 'No detectado',
        },
        {
            icon: Layers,
            label: 'Procedimiento',
            value: ((dg as Record<string, unknown>).tipoProcedimiento as string) || 'Abierto',
        },
        {
            icon: Users,
            label: 'Clasificación CPV',
            value: mainCpv,
        },
        {
            icon: Tag,
            label: 'Tipo de Contrato',
            value: ((dg as Record<string, unknown>).tipoContrato as string) || 'Servicios',
        },
    ];

    // Mock tags since we don't extract them exactly like this yet, we can use generic or cpv derived ones
    const tags = cpvs.length > 0 ? ['TIC', 'Servicios', 'Público'] : ['Licita'];

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
                {/* Main summary text block (Fallback manually built using VM data) */}
                <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
                    <p>
                        La presente licitación, promovida por{' '}
                        <strong>{unwrap(dg.organoContratacion) || 'entidad pública'}</strong>, tiene por objeto{' '}
                        <em>"{unwrap(dg.titulo) || 'contratación de servicios'}"</em>.
                    </p>
                    <p>
                        El presupuesto base de licitación asciende a <strong>{vm.display.presupuesto}</strong>. La
                        duración prevista es de {vm.display.plazo}.
                    </p>
                    {vm.warnings.length > 0 && (
                        <p className="text-slate-500 italic text-xs border-l-2 border-cyan/50 pl-3">
                            Nota: Se han detectado alertas y riesgos potenciales en la documentación extraída. Consulte
                            el panel lateral para mayor detalle.
                        </p>
                    )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {tags.map((tag) => (
                        <span
                            key={tag}
                            className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 hover:border-cyan/40 hover:text-cyan-muted hover:bg-cyan/5 transition-colors cursor-default select-none"
                        >
                            {tag}
                        </span>
                    ))}
                </div>

                {/* Metadata grid */}
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
