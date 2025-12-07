
import { useState, useCallback } from 'react';
import { AnalysisState, LicitacionData } from '../types';
import { AIService } from '../lib/ai-service';
import { validatePdfMagicBytes, generateFileHash, readFileAsBase64 } from '../lib/file-utils';
import { dbService } from '../lib/db-service';
import { syncService } from '../lib/sync-service';

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
        console.log("🚀 Iniciando proceso de archivo:", file.name, "Size:", file.size);
        setState(prev => ({ ...prev, status: 'READING_PDF', progress: 5, error: null, thinkingOutput: '' }));

        try {
            // 1. Security: Magic Bytes Validation
            console.log("🔍 Validando Magic Bytes...");
            const isValidPdf = await validatePdfMagicBytes(file);
            console.log("✅ Magic Bytes Validos:", isValidPdf);
            if (!isValidPdf) {
                throw new Error("El archivo no es un PDF válido (Magic Bytes mismatch).");
            }

            // 2. Deduplication: Generate Hash
            console.log("🔑 Generando Hash...");
            const hash = await generateFileHash(file);

            // Check Local DB
            const cachedResult = await dbService.getLicitacion(hash);
            if (cachedResult) {
                setState(prev => ({
                    ...prev,
                    status: 'COMPLETED',
                    progress: 100,
                    data: cachedResult.data,
                    fileName: file.name,
                    hash: hash,
                    thinkingOutput: "Documento encontrado en caché local. Cargando resultados instantáneamente..."
                }));
                return;
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
            console.log("📄 PDF convertido a Base64. Longitud:", base64.length);

            if (!API_KEY) {
                console.error("❌ API KEY NO ENCONTRADA en import.meta.env");
                throw new Error("API Key no configurada. Por favor configura VITE_GEMINI_API_KEY.");
            }
            console.log("✅ API KEY detectada (Longitud: " + API_KEY.length + ")");

            const aiService = new AIService(API_KEY);

            // 4. AI Analysis
            const result = await aiService.analyzePdfContent(base64, (thought) => {
                setState(prev => ({ ...prev, thinkingOutput: prev.thinkingOutput + "\n" + thought }));
            });

            // 5. Persistence (Local + Cloud)
            await dbService.saveLicitacion(hash, file.name, result);
            await syncService.syncLicitacion(hash, file.name, result);

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
