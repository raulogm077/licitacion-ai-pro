import { create } from 'zustand';
import { LicitacionData } from '../types';
import { isErr } from '../lib/Result';
import { services } from '../config/service-registry';

import { RealtimeChannel } from '@supabase/supabase-js';

interface LicitacionStore {
    data: LicitacionData | null;
    hash: string | undefined;
    isSaving: boolean;
    saveError: string | null;
    activeChannel: RealtimeChannel | null;

    // Actions
    updateData: (newData: LicitacionData) => Promise<boolean>;
    loadLicitacion: (data: LicitacionData, hash?: string) => void;
    reset: () => void;
}

export const useLicitacionStore = create<LicitacionStore>((set, get) => ({
    data: null,
    hash: undefined,
    isSaving: false,
    saveError: null,
    activeChannel: null,

    updateData: async (newData: LicitacionData) => {
        const { hash } = get();
        if (!hash) {
            // If no hash, we can't persist but we can update memory
            set({ data: newData });
            return true;
        }

        set({ isSaving: true, saveError: null });

        const updateResult = await services.db.updateLicitacion(hash, newData);

        if (isErr(updateResult)) {
            console.error('Failed to update data:', updateResult.error);
            set({ isSaving: false, saveError: updateResult.error.message });
            return false;
        }

        set({ data: newData, isSaving: false });
        return true;
    },

    loadLicitacion: (data: LicitacionData, hash?: string) => {
        const { activeChannel } = get();
        if (activeChannel) activeChannel.unsubscribe();

        let newChannel: RealtimeChannel | null = null;
        if (hash) {
            newChannel = services.db.subscribeToLicitacion(hash, (remoteData) => {
                const currentData = get().data;
                if (JSON.stringify(currentData) !== JSON.stringify(remoteData)) {
                    set({ data: remoteData });
                }
            });
        }

        set({
            data,
            hash,
            saveError: null,
            activeChannel: newChannel
        });
    },

    reset: () => {
        const { activeChannel } = get();
        if (activeChannel) activeChannel.unsubscribe();
        set({ data: null, hash: undefined, isSaving: false, saveError: null, activeChannel: null });
    }
}));
