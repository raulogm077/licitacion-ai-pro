import { PliegoVM } from '../../model/pliego-vm';
import { Card } from '../../../../components/ui/Card';
import { Badge } from '../../../../components/ui/Badge';
import { AlertCircle, AlertTriangle, Check, CheckCircle2, XCircle } from 'lucide-react';
import { EvidenceToggle } from './EvidenceToggle';
import { FeedbackToggle } from './FeedbackToggle';
import { ChapterConfig, SubsectionConfig } from './chapter-config';

interface ChapterRendererProps {
    config: ChapterConfig;
    vm: PliegoVM;
}

export function ChapterRenderer({ config, vm }: ChapterRendererProps) {
    const status = vm.chapters.find((c) => c.id === config.id);

    if (status?.status === 'VACIO' && status.emptyMessage) {
        return (
            <section id={config.id} className="py-8">
                <EmptyChapter title={status.emptyMessage.title} text={status.emptyMessage.text} />
            </section>
        );
    }

    const badge = config.headerBadge?.(vm);
    const hasRiskHeader =
        config.id === 'riesgos' && vm.result.restriccionesYRiesgos.riesgos.some((r) => r.impacto === 'CRITICO');

    return (
        <section id={config.id} className="py-8 scroll-mt-32">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
                    {config.title}
                    {hasRiskHeader && <Badge variant="destructive">Críticos detectados</Badge>}
                </h2>
                {badge && (
                    <Badge variant="outline" className="text-sm font-normal px-3">
                        {badge.text}
                    </Badge>
                )}
            </div>

            {config.id === 'datos' ? (
                <Card className="rounded-2xl border-neutral-200/60 shadow-sm overflow-hidden">
                    <div className="divide-y divide-neutral-100">
                        {config.subsections.map((sub) => (
                            <SubsectionRenderer key={sub.id} config={sub} vm={vm} />
                        ))}
                    </div>
                </Card>
            ) : config.id === 'servicio' ? (
                <div className="grid md:grid-cols-2 gap-6">
                    {config.subsections.map((sub) => (
                        <SubsectionRenderer key={sub.id} config={sub} vm={vm} />
                    ))}
                </div>
            ) : (
                <div className={config.id === 'criterios' ? 'space-y-8' : 'grid gap-6'}>
                    {config.subsections.map((sub) => (
                        <SubsectionRenderer key={sub.id} config={sub} vm={vm} />
                    ))}
                </div>
            )}
        </section>
    );
}

function SubsectionRenderer({ config, vm }: { config: SubsectionConfig; vm: PliegoVM }) {
    const items = config.dataExtractor(vm);
    if (items.length === 0) return null;

    switch (config.renderPattern) {
        case 'row-table':
            return <RowTable config={config} items={items} vm={vm} />;
        case 'card-list':
            return <CardList config={config} items={items} vm={vm} />;
        case 'simple-list':
            return <SimpleList config={config} items={items} vm={vm} />;
        case 'risk-list':
            return <RiskList config={config} items={items} vm={vm} />;
        case 'key-value-list':
            return <KeyValueList config={config} items={items} vm={vm} />;
        default:
            return null;
    }
}

function RowTable({ items, vm }: { config: SubsectionConfig; items: unknown[]; vm: PliegoVM }) {
    return (
        <>
            {items.map((item, i) => {
                const row = item as { label: string; value: string; fieldPath: string };
                const isNotDetected = row.value === 'No detectado';
                const isAmb = vm.isAmbiguous(row.fieldPath);
                return (
                    <div
                        key={i}
                        className={`flex flex-col sm:flex-row sm:items-baseline justify-between p-5 hover:bg-slate-50/50 transition-colors gap-2 group relative ${isAmb ? 'bg-orange-50/50' : ''}`}
                    >
                        <div className="flex items-center gap-2 w-1/3">
                            <span className="text-sm font-medium text-slate-500">{row.label}</span>
                            {isAmb && (
                                <div title="Dato ambiguo o contradictorio" className="text-orange-500">
                                    <AlertCircle size={14} />
                                </div>
                            )}
                            <EvidenceToggle
                                evidence={vm.getEvidence(row.fieldPath)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                            <FeedbackToggle
                                fieldPath={row.fieldPath}
                                value={row.value}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                        </div>
                        <span
                            className={`text-sm font-medium text-slate-900 sm:text-right flex-1 ${isNotDetected ? 'italic text-slate-400' : ''}`}
                        >
                            {row.value}
                        </span>
                    </div>
                );
            })}
        </>
    );
}

function CardList({ config, items, vm }: { config: SubsectionConfig; items: unknown[]; vm: PliegoVM }) {
    const dotColor = config.containerClass === 'dot-purple' ? 'bg-purple-500' : 'bg-blue-500';
    const badgeColors: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        purple: 'bg-purple-50 text-purple-700 border-purple-100',
    };

    return (
        <div>
            {config.title && (
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                    {config.title}
                </h3>
            )}
            <div className="grid gap-4">
                {items.map((item, i) => {
                    const fieldPath = `${config.fieldPathPrefix}[${i}]`;
                    const label = config.itemLabel?.(item, i) ?? '';
                    const badge = config.itemBadge?.(item);
                    const subtext = config.itemSubtext?.(item);
                    return (
                        <div
                            key={i}
                            className="bg-white p-5 rounded-2xl border border-neutral-200/60 shadow-sm relative group"
                        >
                            <div className="absolute top-4 right-4">
                                <EvidenceToggle evidence={vm.getEvidence(fieldPath)} />
                                <FeedbackToggle
                                    fieldPath={fieldPath}
                                    value={label}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                />
                            </div>
                            <div className="flex justify-between items-start gap-4 pr-8">
                                <div>
                                    <p className="font-medium text-slate-900 mb-1">{label}</p>
                                    {subtext && (
                                        <p className="text-xs text-slate-500 font-mono bg-slate-50 p-1.5 rounded mt-2 block w-fit">
                                            {subtext}
                                        </p>
                                    )}
                                </div>
                                {badge && (
                                    <Badge className={`${badgeColors[badge.variant] ?? ''} shrink-0`}>
                                        {badge.text}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function SimpleList({ config, items, vm }: { config: SubsectionConfig; items: unknown[]; vm: PliegoVM }) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/60 shadow-sm">
            {config.title && <h3 className="font-semibold text-slate-900 mb-4">{config.title}</h3>}
            <ul className={config.iconType === 'check' ? 'space-y-2' : 'space-y-3'}>
                {items.map((item, i) => {
                    const fieldPath = `${config.fieldPathPrefix}[${i}]`;
                    const text = config.itemLabel?.(item, i) ?? '';
                    const isAmb = vm.isAmbiguous(fieldPath);
                    const required = config.isRequired?.(item) ?? true;

                    return (
                        <li
                            key={i}
                            className={`flex gap-3 text-sm group items-start p-1 rounded ${isAmb ? 'bg-orange-50' : ''}`}
                        >
                            <ItemIcon type={config.iconType ?? 'bullet-required'} required={required} />
                            <span className="text-slate-700 flex-1">
                                {text}
                                {isAmb && <AlertTriangle className="inline w-3 h-3 text-orange-500 ml-2" />}
                            </span>
                            <EvidenceToggle
                                evidence={vm.getEvidence(fieldPath)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                            <FeedbackToggle
                                fieldPath={fieldPath}
                                value={text}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function RiskList({ config, items, vm }: { config: SubsectionConfig; items: unknown[]; vm: PliegoVM }) {
    const isKillCriteria = config.containerClass === 'kill-criteria';

    if (isKillCriteria) {
        return (
            <div className="bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm">
                <h3 className="font-bold text-red-900 mb-4 flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    {config.title}
                </h3>
                <ul className="space-y-4">
                    {items.map((item, i) => {
                        const fieldPath = `${config.fieldPathPrefix}[${i}]`;
                        const text = config.itemLabel?.(item, i) ?? '';
                        const subtext = config.itemSubtext?.(item);
                        return (
                            <li key={i} className="text-red-800 text-sm group relative pr-8">
                                <div className="absolute top-0 right-0">
                                    <EvidenceToggle evidence={vm.getEvidence(fieldPath)} />
                                    <FeedbackToggle
                                        fieldPath={fieldPath}
                                        value={text}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    />
                                </div>
                                <p className="font-semibold">{text}</p>
                                {subtext && <p className="mt-1 opacity-90">{subtext}</p>}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }

    return (
        <div className="grid gap-4">
            {items.map((item, i) => {
                const fieldPath = `${config.fieldPathPrefix}[${i}]`;
                const text = config.itemLabel?.(item, i) ?? '';
                const badge = config.itemBadge?.(item);
                const subtext = config.itemSubtext?.(item);
                const isAmb = vm.isAmbiguous(fieldPath);
                const impacto = (item as { impacto?: string }).impacto;

                return (
                    <div
                        key={i}
                        className={`bg-white p-5 rounded-2xl border border-neutral-200/60 shadow-sm flex items-start gap-4 relative group ${isAmb ? 'ring-2 ring-orange-200 bg-orange-50/30' : ''}`}
                    >
                        <div className="absolute top-4 right-4">
                            <div className="flex gap-2">
                                {isAmb && (
                                    <div title="Dato ambiguo o contradictorio" className="text-orange-500">
                                        <AlertTriangle size={16} />
                                    </div>
                                )}
                                <EvidenceToggle evidence={vm.getEvidence(fieldPath)} />
                                <FeedbackToggle
                                    fieldPath={fieldPath}
                                    value={text}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                />
                            </div>
                        </div>
                        <div
                            className={`p-2 rounded-lg shrink-0 ${
                                impacto === 'CRITICO'
                                    ? 'bg-red-100 text-red-600'
                                    : impacto === 'ALTO'
                                      ? 'bg-orange-100 text-orange-600'
                                      : 'bg-yellow-100 text-yellow-600'
                            }`}
                        >
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="pr-8">
                            <h4 className="font-medium text-slate-900">{text}</h4>
                            {badge && (
                                <div className="flex gap-2 mt-2">
                                    <Badge
                                        variant={
                                            badge.variant === 'destructive'
                                                ? 'destructive'
                                                : badge.variant === 'warning'
                                                  ? 'warning'
                                                  : 'secondary'
                                        }
                                        className="text-[10px] px-2 py-0 h-5"
                                    >
                                        {badge.text}
                                    </Badge>
                                </div>
                            )}
                            {subtext && (
                                <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded">
                                    <strong>Sugerencia:</strong> {subtext}
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function KeyValueList({ config, items, vm }: { config: SubsectionConfig; items: unknown[]; vm: PliegoVM }) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/60 shadow-sm">
            {config.title && <h3 className="font-semibold text-slate-900 mb-4">{config.title}</h3>}
            <ul className="space-y-3">
                {items.map((item, i) => {
                    const fieldPath = `${config.fieldPathPrefix}[${i}]`;
                    const label = config.itemLabel?.(item, i) ?? '';
                    const value = config.itemValue?.(item) ?? '';
                    const subtext = config.itemSubtext?.(item);
                    const badge = config.itemBadge?.(item);

                    return (
                        <li
                            key={i}
                            className="text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0 group relative"
                        >
                            <div className="absolute top-0 right-0 flex items-center gap-2">
                                {badge && (
                                    <Badge variant="secondary" className="text-xs">
                                        {badge.text}
                                    </Badge>
                                )}
                                <EvidenceToggle
                                    evidence={vm.getEvidence(fieldPath)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                />
                                <FeedbackToggle
                                    fieldPath={fieldPath}
                                    value={label}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                />
                            </div>
                            {value ? (
                                <div className="space-y-1 pr-6">
                                    <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
                                    <p className="text-xl font-medium text-slate-900">{value}</p>
                                </div>
                            ) : (
                                <p className="font-medium text-slate-700 pr-6">{label}</p>
                            )}
                            {subtext && <p className="text-slate-500 text-xs mt-1">{subtext}</p>}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function ItemIcon({ type, required }: { type: string; required: boolean }) {
    switch (type) {
        case 'check-circle':
            return <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />;
        case 'check':
            return <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />;
        case 'bullet-required':
        default:
            return required ? (
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
                </div>
            ) : (
                <div className="w-5 h-5 rounded-full border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] text-slate-400">op</span>
                </div>
            );
    }
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
