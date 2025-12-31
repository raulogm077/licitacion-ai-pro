import { create } from 'zustand';
import { ProcessingStatus, LicitacionData } from '../types';
import { LicitacionContent } from '../lib/schemas';
import { useLicitacionStore } from './licitacion.store';
import { processFile } from '../lib/file-utils';
import { isErr } from '../lib/Result';
import { services } from '../config/service-registry';
import { jobService, JobStatus } from '../services/job.service';
import { MAX_PDF_SIZE_BYTES, MAX_PDF_SIZE_MB } from '../config/constants';

interface AnalysisStore {
    status: ProcessingStatus;
    progress: number;
    thinkingOutput: string;
    error: string | null;
    persistenceWarning: string | null;
    abortController: AbortController | null;
    selectedProvider: string; // 'gemini' | 'openai'
    currentJobId: string | null;

    // Actions
    analyzeFile: (file: File) => Promise<void>;
    cancelAnalysis: () => void;
    resetAnalysis: () => void;
    setProvider: (provider: string) => void;
}

const loadSelectedProvider = (): string => {
    try {
        return localStorage.getItem('selectedProvider') || 'gemini';
    } catch {
        return 'gemini';
    }
};

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
    status: 'IDLE',
    progress: 0,
    thinkingOutput: '',
    error: null,
    persistenceWarning: null,
    abortController: null,
    selectedProvider: loadSelectedProvider(),
    currentJobId: null,

    analyzeFile: async (file: File) => {
        const { loadLicitacion, reset: resetLicitacion } = useLicitacionStore.getState();
        const newController = new AbortController();

        resetLicitacion();
        set({
            status: 'READING_PDF',
            progress: 0,
            thinkingOutput: `Iniciando lectura de ${file.name}...`,
            error: null,
            persistenceWarning: null,
            abortController: newController
        });

        try {
            // 1. Validation Fail-Fast
            if (file.size > MAX_PDF_SIZE_BYTES) {
                throw new Error(
                    `El archivo supera el tamaño máximo permitido de ${MAX_PDF_SIZE_MB}MB. ` +
                    `Tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`
                );
            }

            // 2. Optimized File Processing (Single Pass)
            const { hash, base64, isValidPdf } = await processFile(file);

            if (!isValidPdf) {
                throw new Error("El archivo no es un PDF válido.");
            }

            set({ status: 'ANALYZING', progress: 10, thinkingOutput: `Archivo verificado. Hash: ${hash}\nIniciando motor de IA...` });

            // Define onPartialSave for Gemini
            const onPartialSave = async (partialData: Partial<LicitacionData>) => {
                const contentToSave = partialData as LicitacionContent;
                const result = await services.db.saveLicitacion(hash, file.name, contentToSave);
                if (result.ok) {
                    const store = useLicitacionStore.getState();
                    if (!store.hash) {
                        store.loadLicitacion(contentToSave, hash);
                    }
                }
            };

            const { selectedProvider } = get();
            let result: LicitacionContent | undefined;

            // 3. AI Execution Route
            if (selectedProvider === 'openai') {
                set(state => ({
                    status: 'ANALYZING',
                    thinkingOutput: state.thinkingOutput + "\n🔄 Iniciando trabajo en servidor (Async)..."
                }));

                // Start Server Job
                const jobId = await jobService.startJob(base64, file.name, hash);
                set({ currentJobId: jobId, thinkingOutput: `✅ Trabajo iniciado (ID: ${jobId.slice(0, 8)}...)\nEsperando worker...` });

                // Poll for completion
                result = await jobService.waitForCompletion(
                    jobId,
                    (status: JobStatus) => {
                        // Update UI with metadata
                        if (status.step && status.message) {
                            const msg = `[${status.step}] ${status.message}`;
                            set(state => {
                                const lines = state.thinkingOutput.split('\n');
                                if (lines[lines.length - 1] !== msg) {
                                    return { thinkingOutput: state.thinkingOutput + "\n" + msg };
                                }
                                return {};
                            });
                        }
                    },
                    newController.signal
                );

                set(state => ({
                    progress: 90,
                    thinkingOutput: state.thinkingOutput + "\n✅ Resultado recibido del servidor"
                }));

            } else {
                // Gemini (Client-side Sequential)
                result = await services.ai.analyzePdfContent(
                    base64,
                    (processed, total, message) => {
                        const progressWeight = 90 / total;
                        const currentProgress = 10 + Math.round(processed * progressWeight);
                        set(state => ({
                            thinkingOutput: state.thinkingOutput + "\n" + message,
                            progress: Math.min(currentProgress, 90)
                        }));
                    },
                    onPartialSave,
                    newController.signal,
                    selectedProvider
                );
            }

            // 4. Update State & Persist
            loadLicitacion(result, hash);

            set(state => ({
                status: 'COMPLETED',
                progress: 100,
                thinkingOutput: state.thinkingOutput + "\n✅ Análisis completado con éxito.",
                currentJobId: null
            }));

            // Final Persistence
            const saveResult = await services.db.saveLicitacion(hash, file.name, result);
            if (isErr(saveResult)) {
                console.warn("⚠️ Fallo en persistencia remota:", saveResult.error);
                set({ persistenceWarning: `Advertencia: ${saveResult.error.message}. Los datos no se sincronizaron con la nube.` });
            }

        } catch (error) {
            console.error("Critical Analysis Error:", error);
            const errorMessage = error instanceof Error ? error.message : "Error inesperado en el motor de análisis";

            if (errorMessage.includes('cancelado') || errorMessage.includes('Cancelado')) {
                set({ status: 'IDLE', error: null, thinkingOutput: 'Análisis cancelado por el usuario', abortController: null });
            } else {
                set({ status: 'ERROR', error: errorMessage, abortController: null });
            }
        }
    },

    cancelAnalysis: () => {
        const { abortController } = get();
        if (abortController) {
            abortController.abort();
            set({
                status: 'IDLE',
                thinkingOutput: '⚠️ Cancelando análisis...',
                abortController: null
            });
        }
    },

    resetAnalysis: () => {
        const { abortController } = get();
        if (abortController) {
            abortController.abort();
        }
        set({ status: 'IDLE', progress: 0, thinkingOutput: '', error: null, persistenceWarning: null, abortController: null });
    },

    setProvider: (provider: string) => {
        try {
            localStorage.setItem('selectedProvider', provider);
        } catch (error) {
            console.warn('Failed to save provider to localStorage:', error);
        }
        set({ selectedProvider: provider });
    }
}));
