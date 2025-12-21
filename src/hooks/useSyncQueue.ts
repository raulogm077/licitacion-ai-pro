import { useCallback, useEffect, useState } from 'react';
import { peekSyncQueue } from '../lib/sync-queue';
import { syncService } from '../lib/sync-service';

type SyncQueueState = {
    pending: number;
    syncing: boolean;
    lastError: string | null;
};

export function useSyncQueue() {
    const [state, setState] = useState<SyncQueueState>({
        pending: peekSyncQueue().length,
        syncing: false,
        lastError: null,
    });

    const refreshPending = useCallback(() => {
        setState(prev => ({ ...prev, pending: peekSyncQueue().length }));
    }, []);

    const processQueue = useCallback(async () => {
        setState(prev => ({ ...prev, syncing: true, lastError: null }));
        try {
            await syncService.processQueue((pending) => {
                setState(prev => ({ ...prev, pending }));
            });
        } catch (error) {
            setState(prev => ({
                ...prev,
                lastError: error instanceof Error ? error.message : 'Error desconocido al sincronizar.'
            }));
        } finally {
            setState(prev => ({ ...prev, syncing: false }));
        }
    }, []);

    useEffect(() => {
        refreshPending();
        processQueue();
    }, [processQueue, refreshPending]);

    useEffect(() => {
        const handleOnline = () => {
            processQueue();
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [processQueue]);

    useEffect(() => {
        const handleQueueUpdate = () => {
            refreshPending();
        };
        window.addEventListener('sync-queue-updated', handleQueueUpdate);
        return () => window.removeEventListener('sync-queue-updated', handleQueueUpdate);
    }, [refreshPending]);

    return {
        ...state,
        refreshPending,
        processQueue,
    };
}
