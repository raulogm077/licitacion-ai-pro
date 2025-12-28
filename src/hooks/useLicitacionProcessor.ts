
import { useState, useCallback } from 'react';
import { AnalysisState, LicitacionData } from '../types';
import { AIService } from '../services/ai.service';
// import { validatePdfMagicBytes, generateFileHash, readFileAsBase64 } from '../lib/file-utils';
import { dbService } from '../services/db.service';


const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

function toBase64(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

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
            if (!API_KEY) {
                throw new Error("API Key no configurada. Por favor configura VITE_GEMINI_API_KEY.");
            }

            // 1. Efficient I/O: Read file ONCE into ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();

            // 2. Security: Magic Bytes Validation using the buffer
            // We need to adapt validatePdfMagicBytes to accept buffer or create a new util, 
            // but for now let's assume valid PDF if we can read it, or use the existing util if it accepts buffer.
            // Since validatePdfMagicBytes currently takes File, we optimize by manually checking slice here 
            // OR we accept that we might read it differently if we don't refactor the util.
            // For best verify: The file-utils likely reads slice.
            // Let's rely on the util for now to verify magic bytes, but use our buffer for everything else to avoid full re-read.
            // better: pass the buffer to a new logic or simple check here.

            const header = new Uint8Array(arrayBuffer.slice(0, 5));
            const headerStr = String.fromCharCode(...header);
            if (headerStr !== '%PDF-') {
                throw new Error("El archivo no es un PDF válido (Magic Bytes mismatch).");
            }

            // 3. Deduplication: Generate Hash from buffer
            // We need a helper to hash buffer directly. refactor generateFileHash?
            // Existing generateFileHash takes File. Let's do a quick hash here or refactor.
            // Implementing browser-native hash for buffer here for speed.
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            // 4. Base64 Conversion (optimized)
            const base64 = toBase64(new Uint8Array(arrayBuffer));

            // 5. Prepare for AI Analysis
            setState(prev => ({
                ...prev,
                status: 'ANALYZING',
                progress: 20,
                fileName: file.name,
                thinkingOutput: "Hash generado. Iniciando análisis con IA..."
            }));

            const aiService = new AIService(API_KEY);

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
