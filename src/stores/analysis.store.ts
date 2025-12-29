import { create } from 'zustand';
import { ProcessingStatus, LicitacionData } from '../types';
import { LicitacionContent } from '../lib/schemas';
import { useLicitacionStore } from './licitacion.store';
import { generateBufferHash, validateBufferMagicBytes, bufferToBase64 } from '../lib/file-utils';
import { isErr } from '../lib/Result';
import { services } from '../config/service-registry';
import { MAX_PDF_SIZE_BYTES, MAX_PDF_SIZE_MB } from '../config/constants';

interface AnalysisStore {
    status: ProcessingStatus;
    progress: number;
    thinkingOutput: string;
    error: string | null;
    persistenceWarning: string | null;
    abortController: AbortController | null;

    // Actions
    analyzeFile: (file: File) => Promise<void>;
    cancelAnalysis: () => void;
    resetAnalysis: () => void;
}

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
    status: 'IDLE',
    progress: 0,
    thinkingOutput: '',
    error: null,
    persistenceWarning: null,
    abortController: null,

    analyzeFile: async (file: File) => {
        const { loadLicitacion, reset: resetLicitacion } = useLicitacionStore.getState();

        // Create new AbortController for this analysis
        const newController = new AbortController();

        // Reset everything
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
            // Validate file size before processing (Fail-Fast)
            if (file.size > MAX_PDF_SIZE_BYTES) {
                throw new Error(
                    `El archivo supera el tamaño máximo permitido de ${MAX_PDF_SIZE_MB}MB. ` +
                    `Tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`
                );
            }

            const arrayBuffer = await file.arrayBuffer();

            if (!validateBufferMagicBytes(arrayBuffer)) {
                throw new Error("El archivo no es un PDF válido.");
            }

            const hash = await generateBufferHash(arrayBuffer);
            const base64 = await bufferToBase64(arrayBuffer);

            set({ status: 'ANALYZING', progress: 10, thinkingOutput: `Archivo verificado. Hash: ${hash}\nIniciando motor de IA...` });

            // Define onPartialSave integration
            const licitacionStore = useLicitacionStore.getState();
            // Note: We need dynamic access to hash in case it updates, but usually it's stable per file.
            // But if saveLicitacion creates it, we need to know.
            // Actually, we generated buffer hash above (line 47). 
            // DBService 'saveLicitacion(hash,...)' uses this hash as ID.
            // So 'hash' variable is constant here.

            const onPartialSave = async (partialData: Partial<LicitacionData>) => { // Use LicitacionData or Content? Service uses Content.
                // Service returns Partial<LicitacionContent>.
                // We need to cast or just pass it.
                // Let's import LicitacionContent to be safe if possible, or use any.
                // We will trust the service provides correct shape.
                const contentToSave = partialData as LicitacionContent;

                const result = await services.db.saveLicitacion(hash, file.name, contentToSave);
                if (result.ok) {
                    // Update store so user sees progress in UI if needed
                    // Just ensure hash is registered.
                    if (!licitacionStore.hash) {
                        licitacionStore.loadLicitacion(contentToSave, hash);
                    }
                }
            };

            const result = await services.ai.analyzePdfContent(base64, (processed, total, message) => {
                const progressWeight = 90 / total;
                const currentProgress = 10 + Math.round(processed * progressWeight);

                set(state => ({
                    thinkingOutput: state.thinkingOutput + "\n" + message,
                    progress: Math.min(currentProgress, 90)
                }));
            }, onPartialSave, newController.signal);

            // Update data store
            loadLicitacion(result, hash);

            set(state => ({
                status: 'COMPLETED',
                progress: 100,
                thinkingOutput: state.thinkingOutput + "\n✅ Análisis completado con éxito."
            }));

            // Handle persistence in background
            const saveResult = await services.db.saveLicitacion(hash, file.name, result);
            if (isErr(saveResult)) {
                console.warn("⚠️ Fallo en persistencia remota:", saveResult.error);
                set({ persistenceWarning: `Advertencia: ${saveResult.error.message}. Los datos no se sincronizaron con la nube.` });
            }

        } catch (error) {
            console.error("Critical Analysis Error:", error);
            const errorMessage = error instanceof Error ? error.message : "Error inesperado en el motor de análisis";

            // Check if it was a cancellation
            if (errorMessage.includes('cancelado')) {
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
    }
}));
