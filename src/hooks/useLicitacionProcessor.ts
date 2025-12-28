
import { useState, useCallback } from 'react';
import { AnalysisState, LicitacionData } from '../types';
import { AIService } from '../services/ai.service';
import { validatePdfMagicBytes, generateFileHash, readFileAsBase64 } from '../lib/file-utils';
import { dbService } from '../services/db.service';


const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

export function useLicitacionProcessor() {
    const [state, setState] = useState<AnalysisState>({
        status: 'IDLE',
        progress: 0,
        thinkingOutput: '',
        data: null,
        error: null
    });

    const processFile = useCallback(async (file: File) => {
        setState(prev => ({ ...prev, status: 'READING_PDF', progress: 5, error: null, thinkingOutput: '' }));

        try {
            // 1. Security: Magic Bytes Validation
            const isValidPdf = await validatePdfMagicBytes(file);
            if (!isValidPdf) {
                throw new Error("El archivo no es un PDF válido (Magic Bytes mismatch).");
            }

            // 2. Deduplication: Generate Hash (Still used for ID/Persistence, but not for skipping analysis)
            const hash = await generateFileHash(file);

            // CACHE DISABLED: User requested to always re-analyze.
            // keeping hash for saveLicitacion later.

            // 3. Prepare for AI Analysis
            setState(prev => ({
                ...prev,
                status: 'ANALYZING',
                progress: 20,
                fileName: file.name,
                thinkingOutput: "Hash generado. Iniciando análisis con IA..."
            }));

            const base64 = await readFileAsBase64(file);

            if (!API_KEY) {
                throw new Error("API Key no configurada. Por favor configura VITE_GEMINI_API_KEY.");
            }

            const aiService = new AIService(API_KEY);

            // 4. AI Analysis
            const result = await aiService.analyzePdfContent(base64, (thought) => {
                setState(prev => ({ ...prev, thinkingOutput: prev.thinkingOutput + "\n" + thought }));
            });

            console.log("✅ Análisis de AI completado. Resultados obtenidos:", !!result);

            // 5. Persistence to Supabase
            try {
                console.log("💾 Guardando en Supabase...");
                await dbService.saveLicitacion(hash, file.name, result);
                console.log("✅ Datos guardados exitosamente en Supabase");
            } catch (saveError) {
                console.error("❌ Error guardando en Supabase:", saveError);
                // Don't fail the entire flow, but log the error
                setState(prev => ({
                    ...prev,
                    thinkingOutput: prev.thinkingOutput + "\n⚠️ Advertencia: No se pudo guardar en Supabase. Datos disponibles solo en esta sesión."
                }));
            }

            setState(prev => ({
                ...prev,
                status: 'COMPLETED',
                progress: 100,
                data: result,
                hash: hash,
                thinkingOutput: prev.thinkingOutput + "\n✅ Análisis completado."
            }));

        } catch (err) {
            console.error(err);
            setState(prev => ({
                ...prev,
                status: 'ERROR',
                progress: 0,
                error: err instanceof Error ? err.message : "Error desconocido al procesar el archivo"
            }));
        }
    }, []);

    const reset = () => {
        setState({
            status: 'IDLE',
            progress: 0,
            thinkingOutput: '',
            data: null,
            error: null,
            hash: undefined,
        });
    };

    const loadLicitacion = (data: LicitacionData, hash?: string) => {
        setState({
            status: 'COMPLETED',
            progress: 100,
            data: data,
            hash: hash,
            thinkingOutput: 'Cargado desde historial',
            error: null
        });
    };

    return {
        state,
        processFile,
        reset,
        loadLicitacion
    };
}
