import { useState, useCallback, useMemo } from 'react';
import { AnalysisState, LicitacionData } from '../types';
import { dbService } from '../services/db.service';
import { useFileHandler } from './useFileHandler';
import { useAIAnalysis } from './useAIAnalysis';

export function useLicitacionProcessor() {
    const { fileState, processFile: processFileBase, resetFile } = useFileHandler();
    const { aiState, analyze, resetAI } = useAIAnalysis();

    // We maintain a "Legacy" state shape for backwards compatibility with the UI
    // In a future refactor, the UI should consume fileState/aiState directly.
    const [legacyState, setLegacyState] = useState<Partial<AnalysisState>>({
        hash: undefined
    });

    const [persistenceError, setPersistenceError] = useState<string | null>(null);

    const processFile = useCallback(async (file: File) => {
        setPersistenceError(null);
        try {
            // 1. Process File
            const { hash, base64 } = await processFileBase(file);
            setLegacyState({ hash });

            // 2. Run AI
            const result = await analyze(base64, file.name);

            // 3. Persist
            try {
                await dbService.saveLicitacion(hash, file.name, result);
            } catch (saveError) {
                console.error("❌ Error guardando en Supabase:", saveError);
                setPersistenceError("\n⚠️ Advertencia: No se pudo guardar en Supabase. Datos disponibles solo en esta sesión.");
            }

        } catch (error) {
            console.error("Error en proceso:", error);
            // Error state is handled by the sub-hooks, but we log here too
        }
    }, [processFileBase, analyze]);

    const reset = useCallback(() => {
        resetFile();
        resetAI();
        setPersistenceError(null);
        setLegacyState({ hash: undefined });
    }, [resetFile, resetAI]);

    const loadLicitacion = useCallback((data: LicitacionData, hash?: string) => {
        // Manually force AI state to completed to show the dashboard
        // This is a bit of a hack, ideal refactor moves "view state" out of "ai state"
        resetFile();
        // We set the AI state effectively by bypassing the hook's internal setter? 
        // No, we can't easily set internal state of useAIAnalysis from outside.
        // We need `useAIAnalysis` to export a `setResult` or similar, OR we compute the derived state.
        // For now, let's keep the `legacyState` as the source of truth if `loadLicitacion` is called.
        setLegacyState({
            status: 'COMPLETED',
            progress: 100,
            data: data,
            hash: hash,
            thinkingOutput: 'Cargado desde historial',
            error: null
        });
    }, [resetFile]);

    // Derived State: combine the two hooks + legacy overrides
    const state: AnalysisState = useMemo(() => {
        // If we loaded from history (legacyState has data), prioritize that
        if (legacyState.data) {
            return {
                status: 'COMPLETED',
                progress: 100,
                thinkingOutput: legacyState.thinkingOutput || '',
                data: legacyState.data,
                error: null,
                hash: legacyState.hash
            } as AnalysisState;
        }

        // Map sub-hook states to the main AnalysisState
        let status: AnalysisState['status'] = 'IDLE';
        if (fileState.status === 'READING') status = 'READING_PDF';
        else if (aiState.status === 'ANALYZING') status = 'ANALYZING';
        else if (aiState.status === 'COMPLETED') status = 'COMPLETED';
        else if (fileState.status === 'ERROR' || aiState.status === 'ERROR') status = 'ERROR';

        return {
            status,
            progress: Math.max(fileState.status === 'READING' ? 10 : 0, aiState.progress),
            thinkingOutput: (aiState.thinkingOutput || fileState.error || '') + (persistenceError || ''),
            data: aiState.result,
            error: fileState.error || aiState.error || null,
            hash: legacyState.hash || fileState.hash || undefined
        };
    }, [fileState, aiState, legacyState, persistenceError]);

    return {
        state,
        processFile,
        reset,
        loadLicitacion
    };
}
