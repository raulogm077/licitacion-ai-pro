import { create } from 'zustand';
import { ProcessingStatus } from '../types';
import { useLicitacionStore } from './licitacion.store';
import { generateBufferHash, validateBufferMagicBytes, bufferToBase64 } from '../lib/file-utils';
import { isErr } from '../lib/Result';
import { services } from '../config/service-registry';

interface AnalysisStore {
    status: ProcessingStatus;
    progress: number;
    thinkingOutput: string;
    error: string | null;
    persistenceWarning: string | null;

    // Actions
    analyzeFile: (file: File) => Promise<void>;
    resetAnalysis: () => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
    status: 'IDLE',
    progress: 0,
    thinkingOutput: '',
    error: null,
    persistenceWarning: null,

    analyzeFile: async (file: File) => {
        const { loadLicitacion, reset: resetLicitacion } = useLicitacionStore.getState();

        // Reset everything
        resetLicitacion();
        set({
            status: 'READING_PDF',
            progress: 0,
            thinkingOutput: `Iniciando lectura de ${file.name}...`,
            error: null,
            persistenceWarning: null
        });

        try {
            const arrayBuffer = await file.arrayBuffer();

            if (!validateBufferMagicBytes(arrayBuffer)) {
                throw new Error("El archivo no es un PDF válido.");
            }

            const hash = await generateBufferHash(arrayBuffer);
            const base64 = await bufferToBase64(arrayBuffer);

            set({ status: 'ANALYZING', progress: 10, thinkingOutput: `Archivo verificado. Hash: ${hash}\nIniciando motor de IA...` });

            const result = await services.ai.analyzePdfContent(base64, (processed, total, message) => {
                const progressWeight = 90 / total;
                const currentProgress = 10 + Math.round(processed * progressWeight);

                set(state => ({
                    thinkingOutput: state.thinkingOutput + "\n" + message,
                    progress: Math.min(currentProgress, 90)
                }));
            });

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
            set({ status: 'ERROR', error: errorMessage });
        }
    },

    resetAnalysis: () => {
        set({ status: 'IDLE', progress: 0, thinkingOutput: '', error: null, persistenceWarning: null });
    }
}));
