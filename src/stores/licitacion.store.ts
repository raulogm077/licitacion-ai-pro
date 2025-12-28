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
        const { hash, data: previousData } = get();

        // 1. Optimistic Update: Update UI immediately
        set({ data: newData, isSaving: true, saveError: null });

        if (!hash) {
            // Local-only mode
            set({ isSaving: false });
            return true;
        }

        // 2. Perform Async DB Update
        try {
            const updateResult = await services.db.updateLicitacion(hash, newData);

            if (isErr(updateResult)) {
                console.error('Failed to update data:', updateResult.error);
                // 3. Rollback on Error
                set({
                    data: previousData,
                    isSaving: false,
                    saveError: `Error guardando cambios: ${updateResult.error.message}`
                });
                return false;
            }

            // Success: Just clear saving flag
            set({ isSaving: false });
            return true;

        } catch (error) {
            console.error('Unexpected error updating data:', error);
            // 3. Rollback on Exception
            set({
                data: previousData,
                isSaving: false,
                saveError: 'Error inesperado al guardar.'
            });
            return false;
        }
    },

    loadLicitacion: (inputData: LicitacionData, hash?: string) => {
        const { activeChannel } = get();
        if (activeChannel) activeChannel.unsubscribe();

        // Normalize to Envelope if input is just Content (missing result envelope or metadata)
        // We check for 'result' property which distinguishes Envelope from Content in our new schema
        let data: LicitacionData = inputData;

        // If it doesn't have 'result' but has 'datosGenerales', it's likely just Content
        if (!inputData.result && 'datosGenerales' in inputData) {
            const now = new Date().toISOString();
            data = {
                ...inputData, // Includes sections for legacy compat
                result: inputData, // Canonical result
                versions: [{
                    version: 1,
                    status: 'succeeded',
                    created_at: now,
                    model: 'gemini-pro',
                    schema_version: 'v1',
                    prompt_version: 'v1',
                    result: inputData
                }],
                workflow: {
                    current_version: 1,
                    status: 'succeeded',
                    steps: [],
                    updated_at: now
                },
                metadata: inputData.metadata || { tags: [] }
            };
        }

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
