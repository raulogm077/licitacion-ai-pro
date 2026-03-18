import React, { useState, useEffect } from 'react';
import { Upload, Loader2, Lock, X, ArrowRight, ChevronRight, FileType } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { useAuthStore } from '../../../stores/auth.store';
import { useAnalysisStore } from '../../../stores/analysis.store';
import { templateService } from '../../../services/template.service';
import { ExtractionTemplate } from '../../../types';
import { ProviderSelector } from '../../../components/domain/ProviderSelector';
import { CancelButton } from '../../../components/domain/CancelButton';
import { AuthModal } from '../../../components/ui/AuthModal';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

type WizardStep = 'upload' | 'analyzing' | 'completed';

export const AnalysisWizard: React.FC = () => {
    const { t } = useTranslation();
    const { isAuthenticated } = useAuthStore();
    const { status, thinkingOutput, error, analyzeFiles, cancelAnalysis, resetAnalysis, selectedProvider, setProvider } = useAnalysisStore();

    useKeyboardShortcut('Escape', cancelAnalysis, status === 'ANALYZING' || status === 'READING_PDF');

    const [isDragging, setIsDragging] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
        const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const MAX_FILES = 5;
    const MAX_TOTAL_SIZE = 30 * 1024 * 1024;
    const [validationError, setValidationError] = useState<string | null>(null);
    const [templates, setTemplates] = useState<ExtractionTemplate[]>([]);
    const { selectedTemplateId, setTemplateId } = useAnalysisStore();

    useEffect(() => {
        if (isAuthenticated) {
            templateService.getTemplates().then(result => {
                if (result.ok) setTemplates(result.value);
            });
        }
    }, [isAuthenticated]);

    // Sync wizard step with global store status
    useEffect(() => {
        if (status === 'ANALYZING' || status === 'READING_PDF') setCurrentStep('analyzing');
        if (status === 'COMPLETED') setCurrentStep('completed');
        if (status === 'IDLE' || status === 'ERROR') setCurrentStep('upload');
    }, [status]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (isAuthenticated) setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleFilesAdded = (newFiles: FileList | null) => {
        if (!newFiles) return;
        setValidationError(null);

        const validPdfs = Array.from(newFiles).filter(f => f.type === 'application/pdf');

        setSelectedFiles(prev => {
            const combined = [...prev, ...validPdfs];
            if (combined.length > MAX_FILES) {
                setValidationError(`Solo se permiten hasta ${MAX_FILES} archivos.`);
                return combined.slice(0, MAX_FILES);
            }

            const totalSize = combined.reduce((acc, f) => acc + f.size, 0);
            if (totalSize > MAX_TOTAL_SIZE) {
                setValidationError(`El tamaño total supera los ${MAX_TOTAL_SIZE / 1024 / 1024}MB permitidos.`);
                return prev;
            }
            return combined;
        });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (!isAuthenticated) {
            setShowAuthModal(true);
            return;
        }

        handleFilesAdded(e.dataTransfer.files);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isAuthenticated) {
            setShowAuthModal(true);
            return;
        }

        handleFilesAdded(e.target.files);
    };

    const handleStartAnalysis = async () => {
        if (selectedFiles.length > 0) {
            await analyzeFiles(selectedFiles);
        }
    };

    const handleClearAllFiles = () => {
        setSelectedFiles([]);
        resetAnalysis();
    };

    const handleRemoveFile = (indexToRemove: number) => {
        setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
        if (selectedFiles.length === 1) {
            resetAnalysis();
        }
    };

    // --- RENDER HELPERS ---

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center space-x-4 mb-8 text-sm font-medium">
            <div className={`flex items-center ${currentStep === 'upload' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}>
                <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center mr-2 text-xs border-current">1</span>
                {t('wizard.step_upload', 'Subir')}
            </div>
            <ChevronRight size={16} className="text-slate-300" />
            <div className={`flex items-center ${currentStep === 'analyzing' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}>
                <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center mr-2 text-xs border-current">2</span>
                {t('wizard.step_analysis', 'Análisis')}
            </div>
            <ChevronRight size={16} className="text-slate-300" />
            <div className={`flex items-center ${currentStep === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center mr-2 text-xs border-current">3</span>
                {t('wizard.step_result', 'Resultado')}
            </div>
        </div>
    );

    // --- STEP 1: UPLOAD VIEW ---
    if (currentStep === 'upload') {
        return (
            <div className="relative max-w-4xl mx-auto mt-8 px-4">
                <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

                {/* Decorative Background Gradients */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-96 bg-brand-500/20 rounded-full blur-[100px] -z-10 opacity-50 dark:opacity-20 pointer-events-none" />

                {/* Header Section */}
                <div className="text-center mb-8 relative z-10">
                    <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {t('wizard.title')}
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
                        {t('wizard.subtitle')}
                    </p>
                </div>

                {renderStepIndicator()}

                {/* Main Card (Glassmorphism) */}
                <div className="relative backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 border border-white/20 dark:border-slate-700/50 shadow-2xl rounded-3xl overflow-hidden transition-all duration-300">

                    {/* Card Header (Provider Badge) */}
                    {isAuthenticated && (
                        <div className="absolute top-4 right-4 z-20">
                            <ProviderSelector
                                value={selectedProvider}
                                onChange={setProvider}
                                variant="minimal"
                            />
                        </div>
                    )}

                    <div className="p-10 min-h-[500px] flex flex-col justify-center items-center relative">

                        {selectedFiles.length === 0 ? (
                            // --- STATE: NO FILE ---
                            <div
                                className={`
                                    w-full max-w-2xl border-3 border-dashed rounded-2xl p-12 text-center transition-all duration-300 group cursor-pointer
                                    flex flex-col items-center justify-center gap-6
                                    ${!isAuthenticated
                                        ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20'
                                        : isDragging
                                            ? 'border-brand-500 bg-brand-50/30 scale-[1.02]'
                                            : 'border-slate-300 dark:border-slate-600 hover:border-brand-400 hover:bg-white/50 dark:hover:bg-slate-800/50'
                                    }
                                `}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <div className={`
                                    w-24 h-24 rounded-full flex items-center justify-center transition-transform duration-500
                                    ${isAuthenticated ? 'group-hover:scale-110 group-hover:rotate-3' : ''}
                                    ${isDragging ? 'scale-110' : ''}
                                    bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/40 dark:to-brand-800/40
                                `}>
                                    {isAuthenticated ? (
                                        <Upload className="w-10 h-10 text-brand-600 dark:text-brand-400" strokeWidth={1.5} />
                                    ) : (
                                        <Lock className="w-10 h-10 text-slate-400" strokeWidth={1.5} />
                                    )}
                                </div>

                                {validationError && (
                                    <div className="absolute top-4 w-11/12 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-200 dark:border-red-800 animate-in fade-in slide-in-from-top-2">
                                        {validationError}
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                                        {isAuthenticated ? t('wizard.upload_title', 'Sube tu documento PDF') : t('auth.required_title')}
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400">
                                        {isAuthenticated
                                            ? t('wizard.drag_drop_hint', 'Arrastra y suelta aquí o haz clic para explorar')
                                            : t('auth.required_desc')}
                                    </p>
                                </div>

                                {isAuthenticated ? (
                                    <label className="relative pointer-events-none group-hover:pointer-events-auto">
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            multiple
                                            className="sr-only"
                                            onChange={handleFileSelect}
                                        />
                                        <span className="inline-flex items-center px-6 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium text-sm hover:opacity-90 transition-opacity shadow-lg">
                                            Seleccionar Archivo
                                        </span>
                                    </label>
                                ) : (
                                    <button
                                        onClick={() => setShowAuthModal(true)}
                                        className="inline-flex items-center px-6 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium text-sm hover:opacity-90 transition-opacity shadow-lg"
                                    >
                                        Iniciar Sesión
                                    </button>
                                )}
                            </div>
                        ) : (
                            // --- STATE: FILE SELECTED (PREVIEW) ---
                            <div className="w-full max-w-lg animate-in zoom-in-95 duration-300">
                                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-500" />

                                    {validationError && (
                                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-200 dark:border-red-800">
                                            {validationError}
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
                                        {selectedFiles.map((file, idx) => (
                                            <div key={`${file.name}-${idx}`} className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center shrink-0">
                                                        <FileType className="w-5 h-5 text-red-500" strokeWidth={1.5} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="font-medium text-slate-900 dark:text-white text-sm truncate" title={file.name}>
                                                            {file.name}
                                                        </h3>
                                                        <p className="text-xs text-slate-500 font-mono">
                                                            {(file.size / 1024 / 1024).toFixed(2)}&nbsp;MB {idx === 0 && <span className="ml-2 text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">Principal</span>}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveFile(idx)}
                                                    className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-red-500 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                                    title="Eliminar archivo" aria-label={`Eliminar ${file.name}`}
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {templates.length > 0 && (
                                        <div className="w-full text-left mb-6">
                                            <label htmlFor="template-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                Plantilla de Extracción (Opcional)
                                            </label>
                                            <select id="template-select" value={selectedTemplateId || ''}
                                                onChange={(e) => setTemplateId(e.target.value || null)}
                                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                            >
                                                <option value="">Por defecto (Completa)</option>
                                                {templates.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <div className="mt-8 grid grid-cols-2 gap-3">
                                        <button
                                            onClick={handleClearAllFiles}
                                            className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                        >
                                            Cambiar archivo
                                        </button>
                                        <button
                                            onClick={handleStartAnalysis}
                                            className="relative overflow-hidden px-4 py-3 rounded-xl bg-brand-600 text-white font-semibold shadow-lg hover:bg-brand-700 hover:shadow-brand-500/25 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group/btn"
                                        >
                                            <span className="relative z-10">{t('wizard.start_button', 'Analizar con IA')}</span>
                                            <ArrowRight size={18} className="relative z-10 group-hover/btn:translate-x-1 transition-transform" />
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
                                        </button>
                                    </div>

                                    <div className="mt-4 text-center">
                                        <p className="text-xs text-slate-400">
                                            Motor seleccionado: <span className="font-medium text-brand-600 dark:text-brand-400">{selectedProvider.toUpperCase()}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer decoration */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-brand-500 to-blue-600 opacity-20" />
                </div>

                {/* Error Banner */}
                {status === 'ERROR' && error && (
                    <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                        <X className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                            <h3 className="font-semibold text-red-900 dark:text-red-100">Error en el análisis</h3>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1 whitespace-pre-wrap font-mono text-xs">{error}</p>
                            <button
                                onClick={resetAnalysis}
                                className="mt-3 text-sm font-medium text-red-700 hover:text-red-800 dark:hover:text-red-200 underline decoration-red-300 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-sm px-1 -ml-1"
                            >
                                {t('common.retry')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- STEP 2: ANALYZING VIEW ---
    if (currentStep === 'analyzing') {
        const lines = thinkingOutput.split('\n');

        return (
            <div className="max-w-3xl mx-auto mt-12 px-4">
                {renderStepIndicator()}

                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800">
                        <div className="h-full bg-brand-500 animate-progress-indeterminate" />
                    </div>

                    <div className="p-10 text-center">
                        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                            <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900/30 border-t-blue-600 dark:border-t-blue-500 animate-spin"></div>
                            <Loader2 className="text-blue-600 dark:text-blue-400" size={36} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('wizard.analyzing_title') + '…'}</h2>
                        <p className="text-slate-500 dark:text-slate-400">{t('wizard.analyzing_desc')}</p>
                    </div>

                    {/* Terminal / Log Output */}
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
                    <CancelButton onClick={cancelAnalysis} />
                    <p className="text-xs text-slate-400">
                        <Trans i18nKey="wizard.cancel_hint" values={{ key: 'Esc' }} components={{ kbd: <kbd className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-slate-500 dark:text-slate-300 font-sans mx-1" /> }} />
                    </p>
                </div>
            </div>
        );
    }

    return null;
};
