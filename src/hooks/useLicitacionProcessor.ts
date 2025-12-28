import { useState, useCallback, useMemo } from 'react';
import { AnalysisState, LicitacionData } from '../types';
import { dbService } from '../services/db.service';
import { useFileHandler } from './useFileHandler';
import { useAIAnalysis } from './useAIAnalysis';

export function useLicitacionProcessor() {
    const { fileState, processFile: processFileBase, resetFile } = useFileHandler();
    const { aiState, analyze, resetAI, loadResult } = useAIAnalysis();

    // Store hash for items loaded from history (where no file object exists)
    const [historyHash, setHistoryHash] = useState<string | undefined>(undefined);
    const [persistenceError, setPersistenceError] = useState<string | null>(null);

    const processFile = useCallback(async (file: File) => {
        setPersistenceError(null);
        setHistoryHash(undefined); // Clear history context when processing new file

        try {
            // 1. Process File
            const { hash, base64 } = await processFileBase(file);

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
        setHistoryHash(undefined);
    }, [resetFile, resetAI]);

    const loadLicitacion = useCallback((data: LicitacionData, hash?: string) => {
        resetFile();
        setHistoryHash(hash);
        loadResult(data);
    }, [resetFile, loadResult]);

    // Derived State: combine the two hooks
    const state: AnalysisState = useMemo(() => {
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
            hash: fileState.hash || historyHash
        };
    }, [fileState, aiState, historyHash, persistenceError]);

    return {
        state,
        processFile,
        reset,
        loadLicitacion
    };
}
