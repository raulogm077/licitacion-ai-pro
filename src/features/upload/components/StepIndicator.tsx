import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type WizardStep = 'upload' | 'analyzing' | 'completed';

interface StepIndicatorProps {
    currentStep: WizardStep;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
    const { t } = useTranslation();

    return (
        <div className="flex items-center justify-center space-x-4 mb-8 text-sm font-medium">
            <div
                className={`flex items-center ${currentStep === 'upload' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'}`}
            >
                <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center mr-2 text-xs border-current">
                    1
                </span>
                {t('wizard.step_upload', 'Subir')}
            </div>
            <ChevronRight size={16} className="text-slate-300" />
            <div
                className={`flex items-center ${currentStep === 'analyzing' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'}`}
            >
                <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center mr-2 text-xs border-current">
                    2
                </span>
                {t('wizard.step_analysis', 'Análisis')}
            </div>
            <ChevronRight size={16} className="text-slate-300" />
            <div
                className={`flex items-center ${currentStep === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}
            >
                <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center mr-2 text-xs border-current">
                    3
                </span>
                {t('wizard.step_result', 'Resultado')}
            </div>
        </div>
    );
};
