import { supabase as defaultClient } from '../config/supabase';
import { ExtractionTemplate, TemplateField } from '../types';
import { Result, ok, err } from '../lib/Result';
import { SupabaseClient } from '@supabase/supabase-js';
import { appCache, CACHE_KEYS, CACHE_TTL } from '../lib/cache';
import { features } from '../config/features';

export class TemplateService {
    private client: SupabaseClient;

    constructor(client: SupabaseClient = defaultClient) {
        this.client = client;
    }

    async getTemplates(): Promise<Result<ExtractionTemplate[]>> {
        try {
            if (features.enableCaching) {
                const cached = appCache.get<ExtractionTemplate[]>(CACHE_KEYS.ALL_TEMPLATES);
                if (cached) return ok(cached);
            }

            const {
                data: { session },
            } = await this.client.auth.getSession();
            if (!session) {
                return err(new Error('Usuario no autenticado'));
            }

            const { data, error } = await this.client
                .from('extraction_templates')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) return err(new Error(error.message));

            const templates = data as ExtractionTemplate[];
            if (features.enableCaching) {
                appCache.set(CACHE_KEYS.ALL_TEMPLATES, templates, CACHE_TTL.TEMPLATES);
            }
            return ok(templates);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async getTemplate(id: string): Promise<Result<ExtractionTemplate>> {
        try {
            const {
                data: { session },
            } = await this.client.auth.getSession();
            if (!session) {
                return err(new Error('Usuario no autenticado'));
            }

            const { data, error } = await this.client.from('extraction_templates').select('*').eq('id', id).single();

            if (error) return err(new Error(error.message));

            return ok(data as ExtractionTemplate);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async createTemplate(
        name: string,
        description: string,
        schema: TemplateField[]
    ): Promise<Result<ExtractionTemplate>> {
        try {
            const {
                data: { session },
            } = await this.client.auth.getSession();
            if (!session) {
                return err(new Error('Usuario no autenticado'));
            }

            const newTemplate = {
                user_id: session.user.id,
                name,
                description,
                schema,
            };

            const { data, error } = await this.client
                .from('extraction_templates')
                .insert(newTemplate)
                .select()
                .single();

            if (error) return err(new Error(error.message));

            this.invalidateCache();
            return ok(data as ExtractionTemplate);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async updateTemplate(
        id: string,
        updates: { name?: string; description?: string; schema?: TemplateField[] }
    ): Promise<Result<ExtractionTemplate>> {
        try {
            const {
                data: { session },
            } = await this.client.auth.getSession();
            if (!session) {
                return err(new Error('Usuario no autenticado'));
            }

            const { data, error } = await this.client
                .from('extraction_templates')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();

            if (error) return err(new Error(error.message));

            this.invalidateCache();
            return ok(data as ExtractionTemplate);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async deleteTemplate(id: string): Promise<Result<void>> {
        try {
            const {
                data: { session },
            } = await this.client.auth.getSession();
            if (!session) {
                return err(new Error('Usuario no autenticado'));
            }

            const { error } = await this.client.from('extraction_templates').delete().eq('id', id);

            if (error) return err(new Error(error.message));

            this.invalidateCache();
            return ok(undefined);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    private invalidateCache(): void {
        appCache.invalidateByPrefix('tpl:');
    }
}

export const templateService = new TemplateService();
