import { useState, useCallback } from 'react';
import { LicitacionData } from '../types';

export interface AIState {
    status: 'IDLE' | 'ANALYZING' | 'COMPLETED' | 'ERROR';
    progress: number;
    thinkingOutput: string;
    result: LicitacionData | null;
    error: string | null;
}

export function useAIState() {
    const [aiState, setAiState] = useState<AIState>({
        status: 'IDLE',
        progress: 0,
        thinkingOutput: '',
        result: null,
        error: null
    });

    const startAnalysis = useCallback((fileName: string) => {
        setAiState({
            status: 'ANALYZING',
            progress: 0,
            thinkingOutput: `Iniciando análisis de ${fileName}...`,
            result: null,
            error: null
        });
    }, []);

    const updateProgress = useCallback((message: string, processed: number, total: number) => {
        setAiState(prev => ({
            ...prev,
            thinkingOutput: prev.thinkingOutput + "\n" + message,
            progress: Math.min(10 + Math.round((processed / total) * 90), 99)
        }));
    }, []);

    const completeAnalysis = useCallback((result: LicitacionData) => {
        setAiState(prev => ({
            ...prev,
            status: 'COMPLETED',
            progress: 100,
            result,
            thinkingOutput: prev.thinkingOutput + "\n✅ Análisis completado."
        }));
    }, []);

    const setAnalysisError = useCallback((errorMessage: string) => {
        if (errorMessage.includes('cancelado')) {
            setAiState(prev => ({ ...prev, status: 'IDLE', error: null, thinkingOutput: 'Análisis cancelado por el usuario' }));
        } else {
            setAiState(prev => ({ ...prev, status: 'ERROR', error: errorMessage }));
        }
    }, []);

    const cancelAnalysisState = useCallback(() => {
        setAiState(prev => ({
            ...prev,
            status: 'IDLE',
            thinkingOutput: '⚠️ Cancelando análisis...'
        }));
    }, []);

    const resetAIState = useCallback(() => {
        setAiState({ status: 'IDLE', progress: 0, thinkingOutput: '', result: null, error: null });
    }, []);

    const loadResultState = useCallback((result: LicitacionData) => {
        setAiState({
            status: 'COMPLETED',
            progress: 100,
            thinkingOutput: 'Cargado desde historial/memoria.',
            result,
            error: null
        });
    }, []);

    return {
        aiState,
        startAnalysis,
        updateProgress,
        completeAnalysis,
        setAnalysisError,
        cancelAnalysisState,
        resetAIState,
        loadResultState
    };
}
