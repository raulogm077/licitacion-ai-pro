import React, { useState, useEffect } from 'react';
import { Upload, FileText, Loader2, Lock, X } from 'lucide-react';
import { useAuthStore } from '../../../stores/auth.store';
import { useAnalysisStore } from '../../../stores/analysis.store';
import { PluginSelector } from '../../../components/domain/PluginSelector';
import { ProviderSelector } from '../../../components/domain/ProviderSelector';
import { CancelButton } from '../../../components/domain/CancelButton';
import { AuthModal } from '../../../components/ui/AuthModal';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

type WizardStep = 'upload' | 'analyzing' | 'completed';

export const AnalysisWizard: React.FC = () => {
    const { isAuthenticated } = useAuthStore();
    const { status, thinkingOutput, error, analyzeFile, cancelAnalysis, resetAnalysis, selectedProvider, setProvider } = useAnalysisStore();

    // Keyboard shortcut for cancel (Esc key)
    useKeyboardShortcut('Escape', cancelAnalysis, status === 'ANALYZING' || status === 'READING_PDF');

    // Local state for UI
    const [isDragging, setIsDragging] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [currentStep, setCurrentStep] = useState<WizardStep>('upload');

    // Sync wizard step with global store status
    useEffect(() => {
        if (status === 'ANALYZING') setCurrentStep('analyzing');
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

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (!isAuthenticated) {
            setShowAuthModal(true);
            return;
        }

        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            await analyzeFile(file);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isAuthenticated) {
            setShowAuthModal(true);
            return;
        }

        const file = e.target.files?.[0];
        if (file) {
            await analyzeFile(file);
        }
    };

    // --- STEP 1: UPLOAD VIEW ---
    if (currentStep === 'upload') {
        return (
            <div className="max-w-3xl mx-auto mt-12 px-4">
                <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

                {/* Header Text */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 mb-3">
                        Analista de Pliegos
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400">
                        Sube tu pliego de condiciones y nuestra IA extraerá los puntos clave, riesgos y requisitos automáticamente.
                    </p>
                </div>

                {/* Main Upload Card */}
                <div
                    className={`
                        relative overflow-hidden
                        border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300
                        ${!isAuthenticated
                            ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40' // Blurred/Locked state
                            : isDragging
                                ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10 scale-[1.01] shadow-xl'
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:border-brand-400 hover:shadow-md'
                        }
                    `}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {/* Icon Circle */}
                    <div className={`
                        w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors
                        ${isAuthenticated
                            ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}
                    `}>
                        {isAuthenticated ? <Upload size={40} strokeWidth={1.5} /> : <Lock size={40} strokeWidth={1.5} />}
                    </div>

                    {/* Main Action Text */}
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-3">
                        {isAuthenticated ? 'Sube tu documento PDF' : 'Acceso Requerido'}
                    </h2>

                    <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
                        {isAuthenticated
                            ? 'Arrastra y suelta tu archivo aquí, o haz clic para explorar.'
                            : 'Para garantizar la seguridad y el historial de tus análisis, necesitas iniciar sesión.'}
                    </p>

                    {/* Action Buttons */}
                    {isAuthenticated ? (
                        <div className="space-y-6">
                            <label className="group relative inline-flex items-center justify-center px-8 py-4 font-semibold text-white transition-all duration-200 bg-brand-600 rounded-xl hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-500/30 hover:-translate-y-0.5 cursor-pointer">
                                <span className="mr-2">Seleccionar PDF</span>
                                <FileText size={20} className="group-hover:scale-110 transition-transform" />
                                <input data-testid="file-upload-input" type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
                            </label>

                            {/* Provider and Plugin Selection */}
                            <div className="pt-6 border-t border-slate-100 dark:border-slate-700/50 w-full max-w-lg mx-auto space-y-4">
                                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Configuración Avanzada</p>

                                {/* Provider Selector */}
                                <ProviderSelector
                                    value={selectedProvider}
                                    onChange={setProvider}
                                    disabled={status === 'ANALYZING' || status === 'READING_PDF'}
                                />

                                {/* Plugin Selector */}
                                <PluginSelector />
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAuthModal(true)}
                            className="inline-flex items-center gap-2 px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg hover:-translate-y-0.5"
                        >
                            <Lock size={18} />
                            Iniciar Sesión para Continuar
                        </button>
                    )}
                </div>

                {/* Error Banner */}
                {status === 'ERROR' && error && (
                    <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                        <X className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                            <h3 className="font-semibold text-red-900 dark:text-red-100">Error en el análisis</h3>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                            <button
                                onClick={resetAnalysis}
                                className="mt-3 text-sm font-medium text-red-700 hover:text-red-800 dark:hover:text-red-200 underline decoration-red-300 underline-offset-2"
                            >
                                Intentar de nuevo
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
            <div className="max-w-2xl mx-auto mt-16 px-4">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                        <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900/30 border-t-blue-600 dark:border-t-blue-500 animate-spin"></div>
                        <Loader2 className="text-blue-600 dark:text-blue-400" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Analizando Documento</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Nuestra IA está leyendo y estructurando la información...</p>
                </div>

                {/* Terminal / Log Output */}
                <div className="bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-800 font-mono text-sm">
                    <div className="bg-slate-800/50 px-4 py-2 flex items-center gap-2 border-b border-slate-800">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                        </div>
                        <span className="text-slate-500 ml-2 text-xs">analysis_process.log</span>
                    </div>
                    <div className="p-4 h-64 overflow-y-auto scroll-smooth text-emerald-400">
                        {lines.length === 0 && (
                            <span className="opacity-50 italic">Iniciando motor de IA...</span>
                        )}
                        {lines.map((line, i) => (
                            <div key={i} className="mb-1 flex">
                                <span className="opacity-50 mr-2 select-none">$</span>
                                <span className="animate-in fade-in slide-in-from-left-1">{line}</span>
                            </div>
                        ))}
                        <div className="w-2 h-4 bg-emerald-500/50 animate-pulse inline-block align-middle ml-1"></div>
                    </div>
                </div>

                {/* Cancel Button - Enhanced */}
                <div className="mt-6 flex flex-col items-center gap-3">
                    <CancelButton onClick={cancelAnalysis} />
                    <p className="text-xs text-slate-400">
                        Esto puede tomar entre 10-30 segundos. Presiona <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-200">Esc</kbd> para cancelar.
                    </p>
                </div>
            </div>
        );
    }

    // Step 3 (Completed) is handled by the parent HomePage usually showing the Dashboard, 
    // but just in case we need a transition state here:
    return null;
};
