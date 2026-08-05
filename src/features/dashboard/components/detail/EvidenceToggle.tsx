import { useState } from 'react';
import { Eye, ShieldAlert, ShieldCheck, ShieldX, HelpCircle } from 'lucide-react';
import { evidenceVerification, type EvidenceVerification } from '../../../../shared/analysis-contract';

interface Evidence {
    quote: string;
    pageHint?: string;
    verification?: EvidenceVerification;
}

interface EvidenceToggleProps {
    evidence?: Evidence;
    className?: string;
}

/**
 * Cómo se presenta cada estado de verificación.
 *
 * La cita la **escribe el modelo**; hasta que alguien la contrasta contra el
 * documento no acredita nada. Mostrarla entre comillas con número de página le
 * daba la autoridad de una comprobación que nunca ocurrió, y así seis análisis
 * de los mismos PDFs mostraron seis licitaciones distintas «con evidencia»
 * (`docs/adr/ADR-003`).
 *
 * Mientras la verificación no exista (Fase 3 de la ADR), TODO cae en
 * `unverified` — que es la verdad, no un adorno.
 */
const PRESENTATION: Record<
    EvidenceVerification,
    { label: string; note: string; Icon: typeof Eye; tone: string; iconTone: string }
> = {
    verified: {
        label: 'Evidencia verificada',
        note: 'Este texto aparece literalmente en el documento que subiste.',
        Icon: ShieldCheck,
        tone: 'border-success/30 bg-success-light/40 dark:bg-success/10',
        iconTone: 'text-success',
    },
    unverified: {
        label: 'Cita sin verificar',
        note: 'La ha redactado el modelo y todavía no se ha contrastado contra el documento. Compruébala antes de tomar decisiones.',
        Icon: ShieldAlert,
        tone: 'border-warning/30 bg-warning-light/40 dark:bg-warning/10',
        iconTone: 'text-warning',
    },
    not_found: {
        label: 'Cita no encontrada en el documento',
        note: 'Se ha buscado este texto en el documento y no aparece. El dato asociado no es fiable.',
        Icon: ShieldX,
        tone: 'border-danger/30 bg-danger-light/40 dark:bg-danger/10',
        iconTone: 'text-danger',
    },
    unverifiable: {
        label: 'No ha podido verificarse',
        note: 'No hay texto extraíble del documento (p. ej. un PDF escaneado), así que no se ha podido comprobar la cita.',
        Icon: HelpCircle,
        tone: 'border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900',
        iconTone: 'text-slate-400',
    },
};

export function EvidenceToggle({ evidence, className = '' }: EvidenceToggleProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!evidence) return null;

    const state = evidenceVerification(evidence);
    const { label, note, Icon, tone, iconTone } = PRESENTATION[state];

    return (
        <div className={`relative inline-flex items-center ${className}`}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-500 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
                title={label}
            >
                <Eye size={16} />
            </button>

            {isOpen && (
                <div
                    className="absolute left-0 top-full z-50 mt-2 w-64 cursor-auto select-text rounded-lg border border-slate-200 bg-white p-3 text-left text-xs text-slate-600 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 md:w-80"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="mb-1 flex items-center justify-between gap-2 font-semibold text-slate-800 dark:text-slate-200">
                        <span className="flex items-center gap-1.5">
                            <Icon size={13} className={iconTone} aria-hidden="true" />
                            {label}
                        </span>
                        {evidence.pageHint && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                                Pág. {evidence.pageHint}
                            </span>
                        )}
                    </div>

                    <div className="max-h-48 overflow-y-auto rounded border border-slate-100 bg-slate-50 p-2.5 italic leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        "{evidence.quote}"
                    </div>

                    <p className={`mt-2 rounded border px-2 py-1.5 text-[11px] leading-snug ${tone}`}>{note}</p>

                    {/* Backdrop to close when clicking outside (or use a global listener, but this is simple) */}
                    <div className="fixed inset-0 z-[-1]" onClick={() => setIsOpen(false)} aria-hidden="true" />
                </div>
            )}
        </div>
    );
}
