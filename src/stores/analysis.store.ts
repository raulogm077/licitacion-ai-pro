/* eslint-disable */
import { create } from 'zustand';
import { ProcessingStatus, LicitacionData } from '../types';
import { LicitacionContent } from '../lib/schemas';
import { useLicitacionStore } from './licitacion.store';
import { processFile } from '../lib/file-utils';
import { isErr } from '../lib/Result';
import { services } from '../config/service-registry';
import { templateService } from '../services/template.service';
import { MAX_PDF_SIZE_BYTES, MAX_PDF_SIZE_MB } from '../config/constants';

interface AnalysisStore {
    status: ProcessingStatus;
    progress: number;
    thinkingOutput: string;
    error: string | null;
    persistenceWarning: string | null;
    abortController: AbortController | null;
    selectedProvider: string; // 'gemini' | 'openai'
    selectedTemplateId: string | null;
    currentJobId: string | null;

    // Actions
    analyzeFile: (file: File) => Promise<void>;
    cancelAnalysis: () => void;
    resetAnalysis: () => void;
    setProvider: (provider: string) => void;
    setTemplateId: (id: string | null) => void;
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
    selectedTemplateId: null,
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

            // 3. Unified AI Execution Route
            const { selectedProvider, selectedTemplateId } = get();

            let template = null;
            if (selectedTemplateId) {
                const templateResult = await templateService.getTemplate(selectedTemplateId);
                if (templateResult.ok) {
                    template = templateResult.value;
                }
            }

            set(state => ({
                status: 'ANALYZING',
                thinkingOutput: state.thinkingOutput + `\n🚀 Iniciando análisis con ${selectedProvider.toUpperCase()}...`
            }));

            const result = await services.ai.analyzePdfContent(
                base64,
                (processed, total, message) => {
                    // Normalize progress (10% to 90%)
                    const progressWeight = 80 / total; // Use 80% range for analysis (10->90)
                    const currentProgress = 10 + Math.round(processed * progressWeight);

                    set(state => {
                        // Avoid duplicate lines in log
                        const lines = state.thinkingOutput.split('\n');
                        if (lines[lines.length - 1] !== message) {
                            return {
                                thinkingOutput: state.thinkingOutput + "\n" + message,
                                progress: Math.min(currentProgress, 90)
                            };
                        }
                        return { progress: Math.min(currentProgress, 90) };
                    });
                },
                onPartialSave,
                newController.signal,
                selectedProvider,
                file.name, // Required for OpenAI
                hash,      // Required for OpenAI
                template   // Pass the custom extraction template
            );

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

        } catch (error: any) {
            console.error("Critical Analysis Error:", error);
            let errorMessage = "Error inesperado en el motor de análisis";

            if (error instanceof Error) {
                errorMessage = error.message;
            }

            // Handle Supabase/Edge Functions Errors specifically
            if (error?.context?.status) {
                errorMessage = `Error del Servidor (${error.context.status}): ${errorMessage}`;
                // Try to extract body
                try {
                    // Check if context has .json() method (Response object)
                    if (typeof error.context.json === 'function') {
                        const body = await error.context.json();
                        // If backend provides a specific error message, use it as the PRIMARY message, not just detail
                        if (body.error) {
                            errorMessage = body.error; // Use the specific Spanish message from backend
                        } else if (body.message) {
                            errorMessage = body.message;
                        } else {
                            // Fallback if formatting is weird
                            if (body.error) errorMessage += `\nDetalle: ${body.error}`;
                        }
                    }
                } catch (e) { /* ignore body parse error */ }
            } else if (error?.status && error?.statusText) {
                // Fetch/Response error
                errorMessage = `Error HTTP ${error.status}: ${error.statusText}`;
            }

            // Clean up message
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
        set({ status: 'IDLE', progress: 0, thinkingOutput: '', error: null, persistenceWarning: null, abortController: null, selectedTemplateId: null });
    },

    setProvider: (provider: string) => {
        try {
            localStorage.setItem('selectedProvider', provider);
        } catch (error) {
            console.warn('Failed to save provider to localStorage:', error);
        }
        set({ selectedProvider: provider });
    },

    setTemplateId: (id: string | null) => {
        set({ selectedTemplateId: id });
    }
}));
