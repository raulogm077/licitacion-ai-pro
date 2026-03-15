import { useCallback } from 'react';
import { services } from '../config/service-registry';
import { LicitacionData } from '../types';
import { useAIState } from './useAIState';
import { useAbortController } from './useAbortController';

export function useAIAnalysis() {
    const {
        aiState,
        startAnalysis,
        updateProgress,
        completeAnalysis,
        setAnalysisError,
        cancelAnalysisState,
        resetAIState,
        loadResultState
    } = useAIState();

    const { createAbortController, getSignal, abort, clear } = useAbortController();

    const analyze = useCallback(async (base64: string, fileName: string) => {
        // Create new AbortController for this analysis
        createAbortController();

        startAnalysis(fileName);

        try {
            // apiKey no longer needed on client side (Backend Proxy)
            const result = await services.ai.analyzePdfContent(base64, (processed, total, message) => {
                updateProgress(message, processed, total);
            }, undefined, getSignal());

            completeAnalysis(result);

            return result;

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Error en análisis IA";
            setAnalysisError(errorMessage);
            throw err;
        } finally {
            clear();
        }
    }, [createAbortController, startAnalysis, updateProgress, getSignal, completeAnalysis, setAnalysisError, clear]);

    const cancelAnalysis = useCallback(() => {
        const signal = getSignal();
        if (signal && !signal.aborted) {
            abort();
            cancelAnalysisState();
        }
    }, [getSignal, abort, cancelAnalysisState]);

    const resetAI = useCallback(() => {
        abort();
        resetAIState();
    }, [abort, resetAIState]);

    const loadResult = useCallback((result: LicitacionData) => {
        loadResultState(result);
    }, [loadResultState]);

    return {
        aiState,
        analyze,
        cancelAnalysis,
        resetAI,
        loadResult
    };
}
