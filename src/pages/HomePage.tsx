import React, { Suspense } from 'react';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '../components/common/Card';
import { TagManager } from '../features/common/TagManager';
import { NotesPanel } from '../features/common/NotesPanel';
import { Dashboard } from '../features/dashboard/Dashboard';
import { AnalysisState, LicitacionData } from '../types';

interface HomePageProps {
    state: AnalysisState;
    processFile: (file: File) => Promise<void>;
    reset: () => void;
    handleDataUpdate: (newData: LicitacionData) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ state, processFile, reset, handleDataUpdate }) => {
    const [isDragging, setIsDragging] = React.useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            await processFile(file);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await processFile(file);
        }
    };

    return (
        <Suspense fallback={
            <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-brand-600" size={48} />
            </div>
        }>
            {state.status === 'IDLE' && (
                <div className="max-w-2xl mx-auto mt-20">
                    <div
                        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${isDragging
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 scale-105'
                            : 'border-slate-300 dark:border-slate-700 hover:border-brand-400 hover:bg-white dark:hover:bg-slate-800'
                            }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Upload size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Analiza tu Licitación</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-8">
                            Arrastra tu pliego (PDF) aquí o selecciona un archivo para comenzar el análisis inteligente.
                        </p>

                        <label className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-all cursor-pointer shadow-lg shadow-brand-200 dark:shadow-none hover:shadow-xl hover:-translate-y-0.5">
                            <Upload size={20} />
                            Seleccionar PDF
                            <input type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
                        </label>
                    </div>
                </div>
            )}

            {state.status === 'ANALYZING' && (
                <div className="max-w-xl mx-auto mt-20 text-center">
                    <Loader2 size={48} className="text-brand-600 animate-spin mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Analizando Documento...</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">
                        Nuestra IA está extrayendo los puntos clave. Esto puede tomar unos segundos.
                    </p>

                    <div className="bg-slate-900 rounded-lg p-4 text-left font-mono text-xs text-green-400 h-48 overflow-y-auto shadow-inner">
                        <p className="opacity-50 mb-2">// System Log</p>
                        {state.thinkingOutput.split('\n').map((line, i) => (
                            <p key={i} className="mb-1">{`> ${line}`}</p>
                        ))}
                        <span className="animate-pulse">_</span>
                    </div>
                </div>
            )}

            {state.status === 'ERROR' && (
                <div className="max-w-xl mx-auto mt-20">
                    <Card className="border-danger-200 bg-danger-50 dark:bg-danger-900/20">
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 bg-danger-100 dark:bg-danger-900/30 text-danger-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-danger-900 dark:text-danger-100 mb-2">Error en el Análisis</h3>
                            <p className="text-danger-700 dark:text-danger-300 mb-6">{state.error}</p>
                            <button
                                onClick={reset}
                                className="px-4 py-2 bg-white dark:bg-slate-800 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-300 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/40 transition-colors"
                            >
                                Intentar de nuevo
                            </button>
                        </div>
                    </Card>
                </div>
            )}

            {state.status === 'COMPLETED' && state.data && (
                <div className="space-y-6">
                    {/* Tags and Notes Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <TagManager
                            tags={state.data.metadata?.tags || []}
                            onChange={(tags) => {
                                const updatedData = {
                                    ...state.data!,
                                    metadata: { ...state.data!.metadata, tags }
                                };
                                handleDataUpdate(updatedData);
                            }}
                        />

                        <NotesPanel
                            notes={state.data.notas || []}
                            onChange={(notas) => {
                                const updatedData = { ...state.data!, notas };
                                handleDataUpdate(updatedData);
                            }}
                        />
                    </div>

                    {/* Main Dashboard */}
                    <Dashboard data={state.data} onUpdate={handleDataUpdate} />
                </div>
            )}
        </Suspense>
    );
};
