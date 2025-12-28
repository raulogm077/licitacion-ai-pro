import { useState, useCallback } from 'react';
import { generateBufferHash, validateBufferMagicBytes, bufferToBase64 } from '../lib/file-utils';

interface FileState {
    status: 'IDLE' | 'READING' | 'READY' | 'ERROR';
    file: File | null;
    base64: string | null;
    hash: string | null;
    error: string | null;
}

export function useFileHandler() {
    const [fileState, setFileState] = useState<FileState>({
        status: 'IDLE',
        file: null,
        base64: null,
        hash: null,
        error: null
    });

    const processFile = useCallback(async (file: File) => {
        setFileState({ status: 'READING', file, base64: null, hash: null, error: null });

        try {
            // 1. Efficient I/O
            const arrayBuffer = await file.arrayBuffer();

            // 2. Security
            if (!validateBufferMagicBytes(arrayBuffer)) {
                throw new Error("El archivo no es un PDF válido (Magic Bytes mismatch).");
            }

            // 3. Deduplication
            const hash = await generateBufferHash(arrayBuffer);

            // 4. Base64
            const base64 = await bufferToBase64(arrayBuffer);

            setFileState({
                status: 'READY',
                file,
                base64,
                hash,
                error: null
            });

            return { hash, base64 };

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Error leyendo el archivo";
            setFileState(prev => ({ ...prev, status: 'ERROR', error: errorMessage }));
            throw err;
        }
    }, []);

    const resetFile = useCallback(() => {
        setFileState({ status: 'IDLE', file: null, base64: null, hash: null, error: null });
    }, []);

    return {
        fileState,
        processFile,
        resetFile
    };
}
