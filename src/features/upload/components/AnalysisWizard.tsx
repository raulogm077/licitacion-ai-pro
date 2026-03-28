import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../stores/auth.store';
import { useAnalysisStore } from '../../../stores/analysis.store';
import { templateService } from '../../../services/template.service';
import { ExtractionTemplate } from '../../../types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';
import { useFileValidation } from '../hooks/useFileValidation';
import { UploadStep } from './UploadStep';
import { AnalyzingStep } from './AnalyzingStep';

type WizardStep = 'upload' | 'analyzing' | 'completed';

export const AnalysisWizard: React.FC = () => {
    const { isAuthenticated } = useAuthStore();
    const {
        status,
        thinkingOutput,
        error,
        analyzeFiles,
        cancelAnalysis,
        resetAnalysis,
        selectedTemplateId,
        setTemplateId,
    } = useAnalysisStore();

    useKeyboardShortcut('Escape', cancelAnalysis, status === 'ANALYZING' || status === 'READING_PDF');

    const { selectedFiles, validationError, addFiles, removeFile, clearAll } = useFileValidation();
    const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
    const [templates, setTemplates] = useState<ExtractionTemplate[]>([]);

    useEffect(() => {
        if (isAuthenticated) {
            templateService.getTemplates().then((result) => {
                if (result.ok) setTemplates(result.value);
            });
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (status === 'ANALYZING' || status === 'READING_PDF') setCurrentStep('analyzing');
        if (status === 'COMPLETED') setCurrentStep('completed');
        if (status === 'IDLE' || status === 'ERROR') setCurrentStep('upload');
    }, [status]);

    const handleRemoveFile = (index: number) => {
        removeFile(index);
        if (selectedFiles.length === 1) resetAnalysis();
    };

    const handleClearAll = () => {
        clearAll();
        resetAnalysis();
    };

    const handleStartAnalysis = async () => {
        if (selectedFiles.length > 0) {
            await analyzeFiles(selectedFiles);
        }
    };

    if (currentStep === 'analyzing') {
        return <AnalyzingStep thinkingOutput={thinkingOutput} onCancel={cancelAnalysis} />;
    }

    if (currentStep === 'upload') {
        return (
            <UploadStep
                isAuthenticated={isAuthenticated}
                selectedFiles={selectedFiles}
                validationError={validationError}
                templates={templates}
                selectedTemplateId={selectedTemplateId}
                error={status === 'ERROR' ? error : null}
                onFilesAdded={addFiles}
                onRemoveFile={handleRemoveFile}
                onClearAll={handleClearAll}
                onStartAnalysis={handleStartAnalysis}
                onResetAnalysis={resetAnalysis}
                onSetTemplateId={setTemplateId}
            />
        );
    }

    return null;
};
