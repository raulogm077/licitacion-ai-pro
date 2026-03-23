import { useState, useCallback } from 'react';

const MAX_FILES = 5;
const MAX_TOTAL_SIZE = 30 * 1024 * 1024;

export function useFileValidation() {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [validationError, setValidationError] = useState<string | null>(null);

    const addFiles = useCallback((newFiles: FileList | null) => {
        if (!newFiles) return;
        setValidationError(null);

        const validPdfs = Array.from(newFiles).filter((f) => f.type === 'application/pdf');

        setSelectedFiles((prev) => {
            const combined = [...prev, ...validPdfs];
            if (combined.length > MAX_FILES) {
                setValidationError(`Solo se permiten hasta ${MAX_FILES} archivos.`);
                return combined.slice(0, MAX_FILES);
            }

            const totalSize = combined.reduce((acc, f) => acc + f.size, 0);
            if (totalSize > MAX_TOTAL_SIZE) {
                setValidationError(`El tamaño total supera los ${MAX_TOTAL_SIZE / 1024 / 1024}MB permitidos.`);
                return prev;
            }
            return combined;
        });
    }, []);

    const removeFile = useCallback((indexToRemove: number) => {
        setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    }, []);

    const clearAll = useCallback(() => {
        setSelectedFiles([]);
        setValidationError(null);
    }, []);

    return { selectedFiles, validationError, addFiles, removeFile, clearAll };
}
