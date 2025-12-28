import { useState, useCallback } from 'react';
import { AIService } from '../services/ai.service';
import { LicitacionData } from '../types';

interface AIState {
    status: 'IDLE' | 'ANALYZING' | 'COMPLETED' | 'ERROR';
    progress: number;
    thinkingOutput: string;
    result: LicitacionData | null;
    error: string | null;
}

export function useAIAnalysis() {
    const [aiState, setAiState] = useState<AIState>({
        status: 'IDLE',
        progress: 0,
        thinkingOutput: '',
        result: null,
        error: null
    });

    const analyze = useCallback(async (base64: string, fileName: string) => {
        setAiState({
            status: 'ANALYZING',
            progress: 0,
            thinkingOutput: `Iniciando análisis de ${fileName}...`,
            result: null,
            error: null
        });

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
            if (!apiKey) throw new Error("API Key no configurada.");

            const aiService = new AIService(apiKey);

            const result = await aiService.analyzePdfContent(base64, (thought) => {
                setAiState(prev => ({
                    ...prev,
                    thinkingOutput: prev.thinkingOutput + "\n" + thought,
                    progress: Math.min(prev.progress + 15, 90) // Hacky progress simulation
                }));
            });

            setAiState(prev => ({
                ...prev,
                status: 'COMPLETED',
                progress: 100,
                result,
                thinkingOutput: prev.thinkingOutput + "\n✅ Análisis completado."
            }));

            return result;

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Error en análisis IA";
            setAiState(prev => ({ ...prev, status: 'ERROR', error: errorMessage }));
            throw err;
        }
    }, []);

    const resetAI = useCallback(() => {
        setAiState({ status: 'IDLE', progress: 0, thinkingOutput: '', result: null, error: null });
    }, []);

    return {
        aiState,
        analyze,
        resetAI
    };
}
