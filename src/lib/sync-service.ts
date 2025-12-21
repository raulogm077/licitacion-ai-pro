import { LicitacionData } from '../types';
import { enqueueSync, peekSyncQueue, replaceSyncQueue } from './sync-queue';
import { logger } from './logger';

type SyncResult = {
    success: boolean;
    queued: boolean;
};

export const syncService = {
    async syncLicitacion(
        hash: string,
        fileName: string,
        data: LicitacionData,
        userId?: string,
        options: { enqueueOnFail?: boolean } = {}
    ): Promise<SyncResult> {
        try {
            const { collection, addDoc } = await import('firebase/firestore');
            const { db } = await import('./firebase');

            await addDoc(collection(db, 'licitaciones'), {
                ...data,
                fileName,
                hash,
                createdAt: new Date(),
                userId: userId || 'anonymous'
            });
            logger.info("Sincronizado con Firestore");
            return { success: true, queued: false };
        } catch (error) {
            logger.warn("No se pudo sincronizar con la nube (posiblemente falta config o permisos):", error);
            if (options.enqueueOnFail !== false) {
                enqueueSync({ hash, fileName, data, userId });
            }
            return { success: false, queued: true };
        }
    },

    async processQueue(onProgress?: (pending: number) => void) {
        const pending = peekSyncQueue();
        if (pending.length === 0) {
            onProgress?.(0);
            return;
        }

        const remaining: typeof pending = [];

        for (const item of pending) {
            try {
                const result = await syncService.syncLicitacion(item.hash, item.fileName, item.data, item.userId, { enqueueOnFail: false });
                if (!result.success) {
                    remaining.push(item);
                }
            } catch (error) {
                logger.warn('Error retrying sync:', error);
                remaining.push(item);
            }
            onProgress?.(remaining.length);
        }

        replaceSyncQueue(remaining);
    }
};
