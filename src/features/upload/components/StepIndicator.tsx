import React from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';

type WizardStep = 'upload' | 'analyzing' | 'completed';

interface StepIndicatorProps {
    currentStep: WizardStep;
}

const STEP_ORDER: WizardStep[] = ['upload', 'analyzing', 'completed'];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
    const { t } = useTranslation();
    const currentIndex = STEP_ORDER.indexOf(currentStep);

    const steps = [
        { key: 'upload' as const, label: t('wizard.step_upload', 'Subir') },
        { key: 'analyzing' as const, label: t('wizard.step_analysis', 'Análisis') },
        { key: 'completed' as const, label: t('wizard.step_result', 'Resultado') },
    ];

    return (
        <div className="mb-8 flex items-center justify-center text-sm font-medium" aria-label="Progreso del asistente">
            {steps.map((step, i) => {
                const isDone = i < currentIndex;
                const isActive = i === currentIndex;
                return (
                    <React.Fragment key={step.key}>
                        {i > 0 && (
                            <div className="mx-3 h-0.5 w-10 overflow-hidden rounded-full bg-slate-200 sm:w-16 dark:bg-slate-700">
                                <div
                                    className={cn(
                                        'h-full rounded-full bg-brand-gradient transition-all duration-700 ease-out',
                                        i <= currentIndex ? 'w-full' : 'w-0'
                                    )}
                                />
                            </div>
                        )}
                        <div
                            className={cn(
                                'flex items-center gap-2 transition-colors duration-300',
                                isActive
                                    ? 'text-brand-600 dark:text-brand-400'
                                    : isDone
                                      ? 'text-slate-700 dark:text-slate-300'
                                      : 'text-slate-400 dark:text-slate-500'
                            )}
                            aria-current={isActive ? 'step' : undefined}
                        >
                            <span
                                className={cn(
                                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300',
                                    isDone
                                        ? 'bg-brand-gradient text-white'
                                        : isActive
                                          ? 'border-2 border-brand-500 bg-brand-50 text-brand-600 shadow-glow dark:bg-brand-950 dark:text-brand-400'
                                          : 'border-2 border-current'
                                )}
                            >
                                {isDone ? <Check size={14} strokeWidth={3} /> : i + 1}
                            </span>
                            <span className="hidden sm:inline">{step.label}</span>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
};
