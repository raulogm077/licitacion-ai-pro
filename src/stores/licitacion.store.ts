import { create } from 'zustand';
import { AnalysisState, LicitacionData } from '../types';
import { dbService } from '../services/db.service';
import { AIService } from '../services/ai.service';
import { generateBufferHash, validateBufferMagicBytes, bufferToBase64 } from '../lib/file-utils';

interface LicitacionStore {
    state: AnalysisState;
    persistenceError: string | null;

    // Actions
    processFile: (file: File) => Promise<void>;
    updateData: (newData: LicitacionData) => Promise<void>;
    loadLicitacion: (data: LicitacionData, hash?: string) => void;
    reset: () => void;
}

const initialState: AnalysisState = {
    status: 'IDLE',
    progress: 0,
    thinkingOutput: '',
    data: null,
    error: null,
    hash: undefined
};

export const useLicitacionStore = create<LicitacionStore>((set, get) => ({
    state: initialState,
    persistenceError: null,

    processFile: async (file: File) => {
        set({
            state: { ...initialState, status: 'READING_PDF', thinkingOutput: `Leyendo ${file.name}...` },
            persistenceError: null
        });

        try {
            const arrayBuffer = await file.arrayBuffer();

            if (!validateBufferMagicBytes(arrayBuffer)) {
                throw new Error("El archivo no es un PDF válido.");
            }

            const hash = await generateBufferHash(arrayBuffer);
            const base64 = await bufferToBase64(arrayBuffer);

            set(prev => ({
                state: { ...prev.state, status: 'ANALYZING', hash, progress: 10 }
            }));

            const aiService = new AIService();
            const result = await aiService.analyzePdfContent(base64, (thought) => {
                set(prev => ({
                    state: {
                        ...prev.state,
                        thinkingOutput: prev.state.thinkingOutput + "\n" + thought,
                        progress: Math.min(prev.state.progress + 15, 90)
                    }
                }));
            });

            set(prev => ({
                state: {
                    ...prev.state,
                    status: 'COMPLETED',
                    progress: 100,
                    data: result,
                    thinkingOutput: prev.state.thinkingOutput + "\n✅ Análisis completado."
                }
            }));

            // Persist
            try {
                await dbService.saveLicitacion(hash, file.name, result);
            } catch (saveError) {
                console.error("❌ Error guardando en Supabase:", saveError);
                set({ persistenceError: "\n⚠️ Advertencia: No se pudo guardar en Supabase. Datos disponibles solo en esta sesión." });
            }

        } catch (error) {
            console.error("Error en proceso:", error);
            const errorMessage = error instanceof Error ? error.message : "Error desconocido";
            set(prev => ({
                state: { ...prev.state, status: 'ERROR', error: errorMessage }
            }));
        }
    },

    updateData: async (newData: LicitacionData) => {
        const { state } = get();
        if (!state.hash) return;

        try {
            await dbService.updateLicitacion(state.hash, newData);
            set(prev => ({
                state: { ...prev.state, data: newData }
            }));
        } catch (error) {
            console.error('Failed to update data:', error);
        }
    },

    loadLicitacion: (data: LicitacionData, hash?: string) => {
        set({
            state: {
                status: 'COMPLETED',
                progress: 100,
                thinkingOutput: 'Cargado desde historial.',
                data,
                error: null,
                hash
            }
        });
    },

    reset: () => {
        set({ state: initialState, persistenceError: null });
    }
}));
