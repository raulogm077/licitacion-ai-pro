import React, { useEffect, useRef } from 'react';
import { Check, FileSearch, Loader2, Map, Puzzle, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { CancelButton } from '../../../components/domain/CancelButton';
import { StepIndicator } from './StepIndicator';
import { cn } from '../../../lib/utils';
import { ANALYSIS_PHASES, type AnalysisPhase } from '../../../shared/analysis-contract';

interface AnalyzingStepProps {
    thinkingOutput: string;
    progress: number;
    currentPhase: AnalysisPhase | null;
    onCancel: () => void;
}

const PHASE_META: Record<AnalysisPhase, { label: string; icon: React.ReactNode }> = {
    ingestion: { label: 'Ingesta del documento', icon: <FileSearch size={15} /> },
    document_map: { label: 'Mapa del documento', icon: <Map size={15} /> },
    extraction: { label: 'Extracción de bloques', icon: <Puzzle size={15} /> },
    consolidation: { label: 'Consolidación', icon: <Sparkles size={15} /> },
    validation: { label: 'Validación', icon: <ShieldCheck size={15} /> },
};

export const AnalyzingStep: React.FC<AnalyzingStepProps> = ({ thinkingOutput, progress, currentPhase, onCancel }) => {
    const { t } = useTranslation();
    const lines = thinkingOutput.split('\n');
    const terminalEndRef = useRef<HTMLDivElement | null>(null);

    // Keep the newest log line visible as output streams in.
    useEffect(() => {
        terminalEndRef.current?.scrollIntoView?.({ block: 'nearest' });
    }, [thinkingOutput]);

    const activeIndex = currentPhase ? ANALYSIS_PHASES.indexOf(currentPhase) : -1;

    return (
        <div className="max-w-3xl mx-auto mt-12 px-4">
            <StepIndicator currentStep="analyzing" />

            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
                {/* Real progress bar driven by pipeline phase weights */}
                <div
                    className="absolute left-0 top-0 h-1 w-full bg-slate-100 dark:bg-slate-800"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progreso del análisis"
                >
                    <div
                        className="h-full bg-brand-gradient transition-[width] duration-700 ease-out"
                        style={{ width: `${Math.max(progress, 4)}%` }}
                    />
                </div>

                <div className="p-8 sm:p-10">
                    <div className="mb-8 text-center">
                        <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-950">
                            <div className="absolute inset-0 rounded-2xl border-2 border-brand-200 dark:border-brand-900" />
                            <Loader2 className="animate-spin text-brand-600 dark:text-brand-400" size={30} />
                            <span className="absolute -right-1 -top-1 flex h-4 w-4">
                                <span className="absolute inline-flex h-full w-full animate-pulse-glow rounded-full bg-accent-400 opacity-75" />
                                <span className="relative inline-flex h-4 w-4 rounded-full bg-accent-500" />
                            </span>
                        </div>
                        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                            {t('wizard.analyzing_title') + '…'}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('wizard.analyzing_desc')}</p>
                        <p
                            className="mt-2 font-display text-3xl font-bold text-gradient tabular-nums"
                            aria-hidden="true"
                        >
                            {progress}%
                        </p>
                    </div>

                    {/* Phase checklist mapped from SSE events */}
                    <ol className="mx-auto max-w-sm space-y-2.5" aria-label="Fases del análisis">
                        {ANALYSIS_PHASES.map((phase, i) => {
                            const isDone = activeIndex > i || progress >= 100;
                            const isActive = activeIndex === i && progress < 100;
                            return (
                                <li
                                    key={phase}
                                    className={cn(
                                        'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all duration-300',
                                        isActive
                                            ? 'bg-brand-50 font-medium text-brand-700 shadow-sm dark:bg-brand-950 dark:text-brand-300'
                                            : isDone
                                              ? 'text-slate-600 dark:text-slate-300'
                                              : 'text-slate-400 dark:text-slate-600'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300',
                                            isDone
                                                ? 'bg-success text-white'
                                                : isActive
                                                  ? 'bg-brand-gradient text-white'
                                                  : 'bg-slate-100 dark:bg-slate-800'
                                        )}
                                    >
                                        {isDone ? (
                                            <Check size={13} strokeWidth={3} />
                                        ) : isActive ? (
                                            <Loader2 size={13} className="animate-spin" />
                                        ) : (
                                            PHASE_META[phase].icon
                                        )}
                                    </span>
                                    {PHASE_META[phase].label}
                                </li>
                            );
                        })}
                    </ol>
                </div>

                <div className="border-t border-slate-200 bg-slate-950 font-mono text-sm dark:border-slate-800">
                    <div className="flex items-center gap-2 border-b border-slate-900 bg-slate-900/50 px-4 py-2">
                        <div className="flex gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/50" />
                            <div className="h-2.5 w-2.5 rounded-full bg-green-500/50" />
                        </div>
                        <span className="ml-2 text-xs text-slate-600">analysis_engine.log</span>
                    </div>
                    <div className="h-48 overflow-y-auto scroll-smooth p-5 font-light text-emerald-400/90">
                        {lines.length === 0 && (
                            <span className="italic opacity-40">Iniciando contexto de ejecución…</span>
                        )}
                        {lines.map((line, i) => (
                            <div key={i} className="mb-1.5 flex leading-relaxed">
                                <span className="mr-3 select-none text-slate-500 opacity-40">➜</span>
                                <span className="animate-in fade-in slide-in-from-left-1">{line}</span>
                            </div>
                        ))}
                        <div className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-emerald-500/50 align-middle" />
                        <div ref={terminalEndRef} />
                    </div>
                </div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-4">
                <CancelButton onClick={onCancel} />
                <p className="text-xs text-slate-400">
                    <Trans
                        i18nKey="wizard.cancel_hint"
                        values={{ key: 'Esc' }}
                        components={{
                            kbd: (
                                <kbd className="mx-1 rounded bg-slate-200 px-2 py-0.5 font-sans text-slate-500 dark:bg-slate-800 dark:text-slate-300" />
                            ),
                        }}
                    />
                </p>
            </div>
        </div>
    );
};
