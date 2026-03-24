import { supabase as defaultClient } from '../config/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { Result, ok, err } from '../lib/Result';

export interface ExtractionFeedback {
    id: string;
    licitacion_hash: string;
    field_path: string;
    value: string;
    feedback_type: 'up' | 'down';
    created_at: string;
}

export class FeedbackService {
    private client: SupabaseClient;

    constructor(client: SupabaseClient = defaultClient) {
        this.client = client;
    }

    async saveFeedback(
        licitacionHash: string,
        fieldPath: string,
        value: string,
        feedbackType: 'up' | 'down'
    ): Promise<Result<ExtractionFeedback>> {
        try {
            const {
                data: { session },
            } = await this.client.auth.getSession();
            if (!session) {
                return err(new Error('Usuario no autenticado'));
            }

            const { data, error } = await this.client
                .from('extraction_feedback')
                .upsert(
                    {
                        user_id: session.user.id,
                        licitacion_hash: licitacionHash,
                        field_path: fieldPath,
                        value,
                        feedback_type: feedbackType,
                    },
                    { onConflict: 'user_id, licitacion_hash, field_path' }
                )
                .select()
                .single();

            if (error) return err(new Error(error.message));
            return ok(data as ExtractionFeedback);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async removeFeedback(licitacionHash: string, fieldPath: string): Promise<Result<void>> {
        try {
            const { error } = await this.client
                .from('extraction_feedback')
                .delete()
                .eq('licitacion_hash', licitacionHash)
                .eq('field_path', fieldPath);

            if (error) return err(new Error(error.message));
            return ok(undefined);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async getFeedbackForLicitacion(licitacionHash: string): Promise<Result<ExtractionFeedback[]>> {
        try {
            const { data, error } = await this.client
                .from('extraction_feedback')
                .select('*')
                .eq('licitacion_hash', licitacionHash);

            if (error) return err(new Error(error.message));
            return ok((data || []) as ExtractionFeedback[]);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }
}

export const feedbackService = new FeedbackService();
