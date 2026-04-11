import { supabase as defaultClient } from '../config/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { LicitacionData, LicitacionContent, SearchFilters, DbLicitacion, WorkflowState } from '../types';
import { qualityService } from './quality.service';
import { Result, ok, err } from '../lib/Result';
import { appCache, CACHE_KEYS, CACHE_TTL } from '../lib/cache';
import { features } from '../config/features';

export class DBService {
    private client: SupabaseClient;

    constructor(client: SupabaseClient = defaultClient) {
        this.client = client;
    }

    private mapToDbLicitacion(item: Record<string, unknown>): DbLicitacion {
        return {
            hash: item.hash as string,
            fileName: item.file_name as string,
            timestamp: new Date(item.updated_at as string).getTime(),
            data: item.data as LicitacionData,
            metadata: (item.data as LicitacionData).metadata || { tags: [] },
        };
    }

    async saveLicitacion(hash: string, fileName: string, content: LicitacionContent): Promise<Result<void>> {
        try {
            // 0. Explicit Auth Check
            const {
                data: { session },
            } = await this.client.auth.getSession();
            if (!session) {
                return err(new Error('Persistencia Bloqueada: No hay sesión activa.'));
            }

            const now = new Date().toISOString();

            // Calculate Quality
            const qualityReport = qualityService.evaluateQuality(content);

            // 1. Fetch existing envelope to manage versioning
            const existingResult = await this.getLicitacion(hash);
            let envelope: LicitacionData;

            if (existingResult.ok) {
                envelope = existingResult.value.data;

                // Append new version
                const nextVersionNumber = (envelope.versions?.length || 0) + 1;
                const newVersion = {
                    version: nextVersionNumber,
                    status: 'succeeded' as const,
                    created_at: now,
                    model: 'ai-analysis',
                    schema_version: 'v1',
                    prompt_version: 'v1',
                    result: content,
                    workflow: {
                        steps: [],
                        status: 'succeeded',
                    },
                };

                envelope.versions = [...(envelope.versions || []), newVersion];
                envelope.result = content;

                // Update Workflow state
                envelope.workflow = {
                    ...(envelope.workflow || {}),
                    current_version: nextVersionNumber,
                    status: 'succeeded',
                    steps: envelope.workflow?.steps || [],
                    updated_at: now,
                    evidences: envelope.workflow?.evidences || [],
                    quality: qualityReport,
                } as WorkflowState;

                // Sync legacy root fields
                envelope = { ...envelope, ...content };
            } else {
                // Create new envelope
                envelope = {
                    ...content, // Legacy sync
                    result: content,
                    versions: [
                        {
                            version: 1,
                            status: 'succeeded',
                            created_at: now,
                            model: 'ai-analysis',
                            schema_version: 'v1',
                            prompt_version: 'v1',
                            result: content,
                        },
                    ],
                    workflow: {
                        current_version: 1,
                        status: 'succeeded',
                        created_at: now,
                        updated_at: now,
                        steps: [],
                        evidences: [],
                        phases: {},
                        quality: qualityReport,
                    } as WorkflowState,
                    metadata: {
                        tags: [],
                    },
                };
            }

            const { error } = await this.client.from('licitaciones').upsert(
                {
                    hash,
                    file_name: fileName,
                    data: envelope,
                    updated_at: now,
                },
                { onConflict: 'user_id, hash' }
            );

            if (error) {
                if (error.code === '42501') {
                    return err(new Error('Persistencia Bloqueada: Falta iniciar sesión o configurar permisos (RLS).'));
                }
                return err(new Error(error.message));
            }

            this.invalidateCache(hash);
            return ok(undefined);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async updateLicitacion(hash: string, data: LicitacionData): Promise<Result<void>> {
        try {
            // Explicit Auth Check for security consistency
            const {
                data: { session },
            } = await this.client.auth.getSession();
            if (!session) {
                return err(new Error('Actualización Bloqueada: No hay sesión activa.'));
            }

            const now = new Date().toISOString();

            const { error } = await this.client
                .from('licitaciones')
                .update({
                    data: data,
                    updated_at: now,
                })
                .eq('hash', hash);

            if (error) return err(new Error(error.message));
            this.invalidateCache(hash);
            return ok(undefined);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async getLicitacion(hash: string): Promise<Result<DbLicitacion>> {
        try {
            if (features.enableCaching) {
                const cached = appCache.get<DbLicitacion>(CACHE_KEYS.LICITACION(hash));
                if (cached) return ok(cached);
            }

            const { data, error } = await this.client.from('licitaciones').select('*').eq('hash', hash).single();

            if (error) return err(new Error(error.message));

            const result = this.mapToDbLicitacion(data);
            if (features.enableCaching) {
                appCache.set(CACHE_KEYS.LICITACION(hash), result, CACHE_TTL.SINGLE_ITEM);
            }
            return ok(result);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async getAllLicitaciones(): Promise<Result<DbLicitacion[]>> {
        try {
            if (features.enableCaching) {
                const cached = appCache.get<DbLicitacion[]>(CACHE_KEYS.ALL_LICITACIONES);
                if (cached) return ok(cached);
            }

            const { data, error } = await this.client
                .from('licitaciones')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) return err(new Error(error.message));

            const results: DbLicitacion[] = (data || []).map((item) => this.mapToDbLicitacion(item));

            if (features.enableCaching) {
                appCache.set(CACHE_KEYS.ALL_LICITACIONES, results, CACHE_TTL.LICITACIONES);
            }
            return ok(results);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async deleteLicitacion(hash: string): Promise<Result<void>> {
        try {
            const { error } = await this.client.from('licitaciones').delete().eq('hash', hash);

            if (error) return err(new Error(error.message));
            this.invalidateCache(hash);
            return ok(undefined);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    private invalidateCache(hash?: string): void {
        appCache.invalidate(CACHE_KEYS.ALL_LICITACIONES);
        if (hash) appCache.invalidate(CACHE_KEYS.LICITACION(hash));
    }

    async advancedSearch(filters: SearchFilters): Promise<Result<DbLicitacion[]>> {
        try {
            let query = this.client.from('licitaciones').select('*');

            if (filters.presupuestoMin !== undefined) {
                // presupuesto is TrackedField { value, status, ... } — access .value
                query = query.filter('data->datosGenerales->presupuesto->>value', 'gte', filters.presupuestoMin);
            }

            if (filters.presupuestoMax !== undefined) {
                query = query.filter('data->datosGenerales->presupuesto->>value', 'lte', filters.presupuestoMax);
            }

            if (filters.estado) {
                query = query.filter('data->metadata->>estado', 'eq', filters.estado);
            }

            if (filters.cliente) {
                // Use JSONB text search or simple ilike if possible.
                // data->metadata->>cliente stores the string.
                query = query.ilike('data->metadata->>cliente', `%${filters.cliente}%`);
            }

            if (filters.fechaDesde) {
                const dateStr = new Date(filters.fechaDesde).toISOString();
                query = query.gte('updated_at', dateStr);
            }

            if (filters.fechaHasta) {
                const dateStr = new Date(filters.fechaHasta).toISOString();
                query = query.lte('updated_at', dateStr);
            }

            // Tags: Logic "OR" (some) is hard in single Postgrest call without complex syntax.
            // Using "contains" (cs) means AND (all tags must be present).
            // Documentation usually implies filters.tags matches ANY? Code used "some".
            // If user wants ANY, we can't easily do it efficiently in one generic filter chain without 'or'.
            // For now, let's keep Tags in memory to ensure logic correctness (OR vs AND mismatch risk),
            // BUT we successfully offloaded Client and Dates.

            const { data, error } = await query;
            if (error) return err(new Error(error.message));

            let results: DbLicitacion[] = (data || []).map((item) => this.mapToDbLicitacion(item));

            if (filters.tags && filters.tags.length > 0) {
                results = results.filter((item) =>
                    item.data.metadata?.tags?.some((tag) => filters.tags!.includes(tag))
                );
            }

            return ok(results);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async searchLicitaciones(query: string): Promise<Result<DbLicitacion[]>> {
        try {
            const trimmed = query.trim();
            if (!trimmed) return this.getAllLicitaciones();

            const { data, error } = await this.client.rpc('search_licitaciones', {
                search_query: trimmed,
            });

            if (error) return err(new Error(error.message));

            const results: DbLicitacion[] = (data || []).map((item: Record<string, unknown>) =>
                this.mapToDbLicitacion(item)
            );
            return ok(results);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    subscribeToLicitacion(hash: string, onUpdate: (data: LicitacionData) => void) {
        return this.client
            .channel(`licitacion:${hash}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'licitaciones',
                    filter: `hash=eq.${hash}`,
                },
                (payload) => {
                    if (payload.new && payload.new.data) {
                        onUpdate(payload.new.data as LicitacionData);
                    }
                }
            )
            .subscribe((status, err) => {
                if (err) {
                    console.warn('[DBService] Realtime channel error:', status, err);
                }
            });
    }
}

export const dbService = new DBService();
