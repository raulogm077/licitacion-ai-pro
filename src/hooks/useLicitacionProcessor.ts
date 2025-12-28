
import { useState, useCallback } from 'react';
import { AnalysisState, LicitacionData } from '../types';
import { AIService } from '../services/ai.service';
import { generateBufferHash, validateBufferMagicBytes, bufferToBase64 } from '../lib/file-utils';
import { dbService } from '../services/db.service';




// function toBase64 removed - using file-utils

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
            // 0. Early Configuration Check
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
            if (!apiKey) {
                throw new Error("API Key no configurada. Por favor configura VITE_GEMINI_API_KEY.");
            }

            // 1. Efficient I/O: Read file ONCE into ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();

            // 2. Security: Magic Bytes Validation using the buffer
            if (!validateBufferMagicBytes(arrayBuffer)) {
                throw new Error("El archivo no es un PDF válido (Magic Bytes mismatch).");
            }

            // 3. Deduplication: Generate Hash from buffer
            // 59: Use helper to allow mocking in tests
            const hash = await generateBufferHash(arrayBuffer);

            // 4. Base64 Conversion (optimized)
            const base64 = await bufferToBase64(arrayBuffer);

            // 5. Prepare for AI Analysis
            setState(prev => ({
                ...prev,
                status: 'ANALYZING',
                progress: 20,
                fileName: file.name,
                thinkingOutput: "Hash generado. Iniciando análisis con IA..."
            }));

            const aiService = new AIService(apiKey);

            // 6. AI Analysis
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
