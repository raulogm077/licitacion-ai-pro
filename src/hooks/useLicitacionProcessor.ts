
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

            // 2. Deduplication: Generate Hash
            const hash = await generateFileHash(file);

            // Check Local DB
            // Check Local DB
            const cachedResult = await dbService.getLicitacion(hash);

            // Validate cache: Only use if it looks like a real analysis (has title or budget)
            const isCacheValid = cachedResult &&
                cachedResult.data &&
                cachedResult.data.datosGenerales &&
                (cachedResult.data.datosGenerales.titulo !== "Sin título" || cachedResult.data.datosGenerales.presupuesto > 0);

            if (isCacheValid) {
                console.log("CACHE HIT: Using cached result for hash", hash);
                setState(prev => ({
                    ...prev,
                    status: 'COMPLETED',
                    progress: 100,
                    data: cachedResult!.data,
                    fileName: file.name,
                    hash: hash,
                    thinkingOutput: "Documento encontrado en caché local. Cargando resultados instantáneamente..."
                }));
                return;
            } else if (cachedResult) {
                console.log("CACHE SKIP: Cached data found but appears invalid/empty. Re-analyzing.");
                // Optional: Delete bad cache? dbService.deleteLicitacion(hash);
            }

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

            // 5. Persistence (Local) with Safety Timeout
            const savePromise = dbService.saveLicitacion(hash, file.name, result);

            // Timeout after 3 seconds - UI takes precedence
            const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));

            await Promise.race([savePromise, timeoutPromise]);
            console.log("💾 Persistencia finalizada (o timeout).");

            setState(prev => ({
                ...prev,
                status: 'COMPLETED',
                progress: 100,
                data: result,
                hash: hash,
                thinkingOutput: prev.thinkingOutput + "\nAnálisis completado y guardado."
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
