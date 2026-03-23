import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { CancelButton } from '../../../components/domain/CancelButton';
import { StepIndicator } from './StepIndicator';

interface AnalyzingStepProps {
    thinkingOutput: string;
    onCancel: () => void;
}

export const AnalyzingStep: React.FC<AnalyzingStepProps> = ({ thinkingOutput, onCancel }) => {
    const { t } = useTranslation();
    const lines = thinkingOutput.split('\n');

    return (
        <div className="max-w-3xl mx-auto mt-12 px-4">
            <StepIndicator currentStep="analyzing" />

            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-brand-500 animate-progress-indeterminate" />
                </div>

                <div className="p-10 text-center">
                    <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                        <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900/30 border-t-blue-600 dark:border-t-blue-500 animate-spin"></div>
                        <Loader2 className="text-blue-600 dark:text-blue-400" size={36} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        {t('wizard.analyzing_title') + '…'}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">{t('wizard.analyzing_desc')}</p>
                </div>

                <div className="bg-slate-950 border-t border-slate-800 font-mono text-sm">
                    <div className="px-4 py-2 flex items-center gap-2 border-b border-slate-900 bg-slate-900/50">
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                        </div>
                        <span className="text-slate-600 ml-2 text-xs">analysis_engine.log</span>
                    </div>
                    <div className="p-6 h-64 overflow-y-auto scroll-smooth text-emerald-400/90 font-light">
                        {lines.length === 0 && (
                            <span className="opacity-40 italic">Iniciando contexto de ejecución…</span>
                        )}
                        {lines.map((line, i) => (
                            <div key={i} className="mb-1.5 flex leading-relaxed">
                                <span className="opacity-40 mr-3 select-none text-slate-500">➜</span>
                                <span className="animate-in fade-in slide-in-from-left-1">{line}</span>
                            </div>
                        ))}
                        <div className="w-1.5 h-4 bg-emerald-500/50 animate-pulse inline-block align-middle ml-1"></div>
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
                                <kbd className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-slate-500 dark:text-slate-300 font-sans mx-1" />
                            ),
                        }}
                    />
                </p>
            </div>
        </div>
    );
};
