import { useState, useCallback, useRef, useEffect } from 'react';
import { services } from '../config/service-registry';
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

    const abortControllerRef = useRef<AbortController | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const analyze = useCallback(async (base64: string, fileName: string) => {
        // Create new AbortController for this analysis
        abortControllerRef.current = new AbortController();

        setAiState({
            status: 'ANALYZING',
            progress: 0,
            thinkingOutput: `Iniciando análisis de ${fileName}...`,
            result: null,
            error: null
        });

        try {
            // apiKey no longer needed on client side (Backend Proxy)
            const result = await services.ai.analyzePdfContent(base64, (processed, total, message) => {
                setAiState(prev => ({
                    ...prev,
                    thinkingOutput: prev.thinkingOutput + "\n" + message,
                    progress: Math.min(10 + Math.round((processed / total) * 90), 99)
                }));
            }, undefined, abortControllerRef.current?.signal);

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

            // Check if it was a cancellation
            if (errorMessage.includes('cancelado')) {
                setAiState(prev => ({ ...prev, status: 'IDLE', error: null, thinkingOutput: 'Análisis cancelado por el usuario' }));
            } else {
                setAiState(prev => ({ ...prev, status: 'ERROR', error: errorMessage }));
            }
            throw err;
        } finally {
            abortControllerRef.current = null;
        }
    }, []);

    const cancelAnalysis = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setAiState(prev => ({
                ...prev,
                status: 'IDLE',
                thinkingOutput: '⚠️ Cancelando análisis...'
            }));
        }
    }, []);

    const resetAI = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setAiState({ status: 'IDLE', progress: 0, thinkingOutput: '', result: null, error: null });
    }, []);

    const loadResult = useCallback((result: LicitacionData) => {
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
        analyze,
        cancelAnalysis,
        resetAI,
        loadResult
    };
}
