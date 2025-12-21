
import { useState, useCallback, useRef } from 'react';
import { AnalysisState, LicitacionData } from '../types';
import { validatePdfMagicBytes, generateFileHash, readFileAsBase64 } from '../lib/file-utils';
import { dbService } from '../lib/db-service';
import { syncService } from '../lib/sync-service';
import { parseSseEvents } from '../lib/sse-utils';
import { validatePdfSize } from '../lib/analysis-guards';
import { auth } from '../lib/firebase';
import { logger } from '../lib/logger';

export function useLicitacionProcessor(userId?: string) {
    const abortControllerRef = useRef<AbortController | null>(null);
    const [state, setState] = useState<AnalysisState>({
        status: 'IDLE',
        progress: 0,
        thinkingOutput: '',
        data: null,
        error: null
    });

    const processFile = useCallback(async (file: File) => {
        logger.info("🚀 Iniciando proceso de archivo:", file.name, "Size:", file.size);
        setState(prev => ({ ...prev, status: 'READING_PDF', progress: 5, error: null, thinkingOutput: '' }));

        try {
            validatePdfSize(file.size);
            // 1. Security: Magic Bytes Validation
            logger.info("🔍 Validando Magic Bytes...");
            const isValidPdf = await validatePdfMagicBytes(file);
            logger.info("✅ Magic Bytes Validos:", isValidPdf);
            if (!isValidPdf) {
                throw new Error("El archivo no es un PDF válido (Magic Bytes mismatch).");
            }

            // 2. Deduplication: Generate Hash
            logger.info("🔑 Generando Hash...");
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
            logger.info("📄 PDF convertido a Base64. Longitud:", base64.length);
            setState(prev => ({ ...prev, progress: 35 }));

            const controller = new AbortController();
            abortControllerRef.current = controller;
            if (!auth.currentUser) {
                throw new Error('Debes iniciar sesión para analizar documentos.');
            }
            const token = await auth.currentUser.getIdToken();

            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ base64 }),
                signal: controller.signal,
            });

            if (!response.ok || !response.body) {
                const errorText = await response.text();
                throw new Error(errorText || 'Error al iniciar el análisis en el servidor.');
            }

            let result: LicitacionData | null = null;
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let chunkCount = 0;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const parsed = parseSseEvents(buffer);
                buffer = parsed.remaining;

                for (const payload of parsed.events) {
                    if (payload.type === 'status') {
                        setState(prev => ({ ...prev, thinkingOutput: prev.thinkingOutput + `\n${payload.message}` }));
                        setState(prev => ({ ...prev, progress: Math.min(prev.progress + 5, 90) }));
                    }

                    if (payload.type === 'chunk') {
                        setState(prev => ({ ...prev, thinkingOutput: prev.thinkingOutput + payload.message }));
                        chunkCount += 1;
                        if (chunkCount % 5 === 0) {
                            setState(prev => ({ ...prev, progress: Math.min(prev.progress + 2, 90) }));
                        }
                    }

                    if (payload.type === 'result') {
                        result = payload.data;
                        setState(prev => ({ ...prev, progress: 95 }));
                    }

                    if (payload.type === 'error') {
                        throw new Error(payload.message);
                    }
                }
            }

            if (!result) {
                throw new Error('No se recibió un resultado válido del servidor.');
            }

            // 5. Persistence (Local + Cloud)
            await dbService.saveLicitacion(hash, file.name, result);
            await syncService.syncLicitacion(hash, file.name, result, userId);

            setState(prev => ({
                ...prev,
                status: 'COMPLETED',
                progress: 100,
                data: result,
                hash: hash,
                thinkingOutput: prev.thinkingOutput + "\nAnálisis completado y guardado."
            }));

        } catch (err) {
            logger.error(err);
            const message = err instanceof Error && err.name === 'AbortError'
                ? 'Análisis cancelado por el usuario.'
                : err instanceof Error
                    ? err.message
                    : "Error desconocido al procesar el archivo";
            setState(prev => ({
                ...prev,
                status: message === 'Análisis cancelado por el usuario.' ? 'CANCELLED' : 'ERROR',
                progress: 0,
                error: message
            }));
        } finally {
            abortControllerRef.current = null;
        }
    }, [userId]);

    const cancelAnalysis = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setState(prev => ({
            ...prev,
            status: 'CANCELLED',
            progress: 0,
            error: 'Análisis cancelado por el usuario.'
        }));
    }, []);

    const reset = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
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
        cancelAnalysis,
        reset,
        loadLicitacion
    };
}
