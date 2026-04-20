import React, { useState } from 'react';
import { Upload, Lock, X, ArrowRight, FileType } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ExtractionTemplate } from '../../../types';
import { AuthModal } from '../../../components/ui/AuthModal';
import { StepIndicator } from './StepIndicator';

interface UploadStepProps {
    isAuthenticated: boolean;
    selectedFiles: File[];
    validationError: string | null;
    templates: ExtractionTemplate[];
    selectedTemplateId: string | null;
    error: string | null;
    onFilesAdded: (files: FileList | null) => void;
    onRemoveFile: (index: number) => void;
    onClearAll: () => void;
    onStartAnalysis: () => void;
    onResetAnalysis: () => void;
    onSetTemplateId: (id: string | null) => void;
}

export const UploadStep: React.FC<UploadStepProps> = ({
    isAuthenticated,
    selectedFiles,
    validationError,
    templates,
    selectedTemplateId,
    error,
    onFilesAdded,
    onRemoveFile,
    onClearAll,
    onStartAnalysis,
    onResetAnalysis,
    onSetTemplateId,
}) => {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (isAuthenticated) setIsDragging(true);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (!isAuthenticated) {
            setShowAuthModal(true);
            return;
        }
        onFilesAdded(e.dataTransfer.files);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isAuthenticated) {
            setShowAuthModal(true);
            return;
        }
        onFilesAdded(e.target.files);
    };

    return (
        <div className="relative max-w-4xl mx-auto mt-8 px-4">
            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-96 bg-brand-500/20 rounded-full blur-[100px] -z-10 opacity-50 dark:opacity-20 pointer-events-none" />

            <div className="text-center mb-8 relative z-10">
                <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {t('wizard.title')}
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
                    {t('wizard.subtitle')}
                </p>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-3xl mx-auto">
                    El camino más fiable es subir un único PDF completo del expediente. Si solo subes el PCAP, el PPT o
                    un memo resumido, el análisis será parcial por diseño.
                </p>
            </div>

            <StepIndicator currentStep="upload" />

            <div className="relative backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 border border-white/20 dark:border-slate-700/50 shadow-2xl rounded-3xl overflow-hidden transition-all duration-300">
                {isAuthenticated && (
                    <div className="absolute top-4 right-4 z-20">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <span className="opacity-70">Powered by</span>
                            <span className="ml-1 font-semibold text-brand-600 dark:text-brand-400">OpenAI</span>
                        </span>
                    </div>
                )}

                <div className="p-10 min-h-[500px] flex flex-col justify-center items-center relative">
                    {selectedFiles.length === 0 ? (
                        <div
                            className={`
                                w-full max-w-2xl border-3 border-dashed rounded-2xl p-12 text-center transition-all duration-300 group cursor-pointer
                                flex flex-col items-center justify-center gap-6
                                ${
                                    !isAuthenticated
                                        ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20'
                                        : isDragging
                                          ? 'border-brand-500 bg-brand-50/30 scale-[1.02]'
                                          : 'border-slate-300 dark:border-slate-600 hover:border-brand-400 hover:bg-white/50 dark:hover:bg-slate-800/50'
                                }
                            `}
                            onDragOver={handleDragOver}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                        >
                            <div
                                className={`
                                w-24 h-24 rounded-full flex items-center justify-center transition-transform duration-500
                                ${isAuthenticated ? 'group-hover:scale-110 group-hover:rotate-3' : ''}
                                ${isDragging ? 'scale-110' : ''}
                                bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/40 dark:to-brand-800/40
                            `}
                            >
                                {isAuthenticated ? (
                                    <Upload
                                        className="w-10 h-10 text-brand-600 dark:text-brand-400"
                                        strokeWidth={1.5}
                                    />
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
                                    {isAuthenticated
                                        ? t('wizard.upload_title', 'Sube tu documento PDF')
                                        : t('auth.required_title')}
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
                                        Seleccionar uno o varios PDF
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
                                        <div
                                            key={`${file.name}-${idx}`}
                                            className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50"
                                        >
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center shrink-0">
                                                    <FileType className="w-5 h-5 text-red-500" strokeWidth={1.5} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3
                                                        className="font-medium text-slate-900 dark:text-white text-sm truncate"
                                                        title={file.name}
                                                    >
                                                        {file.name}
                                                    </h3>
                                                    <p className="text-xs text-slate-500 font-mono">
                                                        {(file.size / 1024 / 1024).toFixed(2)}&nbsp;MB{' '}
                                                        {idx === 0 && (
                                                            <span className="ml-2 text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                                                                Principal
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => onRemoveFile(idx)}
                                                className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-red-500 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                                title="Eliminar archivo"
                                                aria-label={`Eliminar ${file.name}`}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {templates.length > 0 && (
                                <div className="w-full text-left mb-6">
                                    <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
                                        El primer PDF se toma como principal. Añade PCAP, PPT y anexos clave solo como
                                        refuerzo cuando no dispongas de un PDF completo del expediente.
                                    </div>
                                    <label
                                        htmlFor="template-select"
                                        className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                                        >
                                            Plantilla de Extracción (Opcional)
                                        </label>
                                        <select
                                            id="template-select"
                                            value={selectedTemplateId || ''}
                                            onChange={(e) => onSetTemplateId(e.target.value || null)}
                                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                        >
                                            <option value="">Por defecto (Completa)</option>
                                            {templates.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="mt-8 grid grid-cols-2 gap-3">
                                    <button
                                        onClick={onClearAll}
                                        className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                    >
                                        Cambiar archivo
                                    </button>
                                    <button
                                        onClick={onStartAnalysis}
                                        className="relative overflow-hidden px-4 py-3 rounded-xl bg-brand-600 text-white font-semibold shadow-lg hover:bg-brand-700 hover:shadow-brand-500/25 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group/btn"
                                    >
                                        <span className="relative z-10">
                                            {t('wizard.start_button', 'Analizar con IA')}
                                        </span>
                                        <ArrowRight
                                            size={18}
                                            className="relative z-10 group-hover/btn:translate-x-1 transition-transform"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
                                    </button>
                                </div>

                                <div className="mt-4 text-center">
                                    <p className="text-xs text-slate-400">
                                        Motor:{' '}
                                        <span className="font-medium text-brand-600 dark:text-brand-400">
                                            OpenAI Responses API
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-1.5 w-full bg-gradient-to-r from-brand-500 to-blue-600 opacity-20" />
            </div>

            {error && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                    <X className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                        <h3 className="font-semibold text-red-900 dark:text-red-100">Error en el análisis</h3>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1 whitespace-pre-wrap font-mono text-xs">
                            {error}
                        </p>
                        <button
                            onClick={onResetAnalysis}
                            className="mt-3 text-sm font-medium text-red-700 hover:text-red-800 dark:hover:text-red-200 underline decoration-red-300 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-sm px-1 -ml-1"
                        >
                            {t('common.retry')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
