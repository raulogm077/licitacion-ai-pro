import { LicitacionData } from '../types';
import { logger } from './logger';

const STORAGE_KEY = 'licitacion-sync-queue';

export type SyncQueueItem = {
    hash: string;
    fileName: string;
    data: LicitacionData;
    userId?: string;
    queuedAt: number;
};

type QueueState = {
    items: SyncQueueItem[];
};

const emptyState: QueueState = { items: [] };

function readState(): QueueState {
    if (typeof window === 'undefined') {
        return emptyState;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return emptyState;
    }

    try {
        const parsed = JSON.parse(raw) as QueueState;
        if (!Array.isArray(parsed.items)) {
            return emptyState;
        }
        return parsed;
    } catch (error) {
        logger.warn('Failed to parse sync queue. Resetting.', error);
        return emptyState;
    }
}

function writeState(state: QueueState) {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('sync-queue-updated'));
}

export function enqueueSync(item: Omit<SyncQueueItem, 'queuedAt'>) {
    const state = readState();
    const existingIndex = state.items.findIndex(existing => existing.hash === item.hash);
    const newItem: SyncQueueItem = { ...item, queuedAt: Date.now() };

    if (existingIndex >= 0) {
        state.items[existingIndex] = newItem;
    } else {
        state.items.push(newItem);
    }

    writeState(state);
}

export function dequeueSync(hash: string) {
    const state = readState();
    const nextItems = state.items.filter(item => item.hash !== hash);
    writeState({ items: nextItems });
}

export function peekSyncQueue(): SyncQueueItem[] {
    return readState().items;
}

export function replaceSyncQueue(items: SyncQueueItem[]) {
    writeState({ items });
}
