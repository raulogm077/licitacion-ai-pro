import { useRef, useEffect, useCallback } from 'react';

export function useAbortController() {
    const abortControllerRef = useRef<AbortController | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const createAbortController = useCallback(() => {
        abortControllerRef.current = new AbortController();
        return abortControllerRef.current;
    }, []);

    const getSignal = useCallback(() => {
        return abortControllerRef.current?.signal;
    }, []);

    const abort = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    const clear = useCallback(() => {
        abortControllerRef.current = null;
    }, []);

    return {
        createAbortController,
        getSignal,
        abort,
        clear
    };
}
