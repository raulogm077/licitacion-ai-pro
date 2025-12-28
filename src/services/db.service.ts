import { supabase } from '../config/supabase';
import { LicitacionData, SearchFilters, DbLicitacion } from '../types';
import { Result, ok, err } from '../lib/Result';

export class DBService {

    async saveLicitacion(hash: string, fileName: string, data: LicitacionData): Promise<Result<void>> {
        try {
            // 0. Explicit Auth Check
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                return err(new Error("Persistencia Bloqueada: No hay sesión activa."));
            }

            const now = new Date().toISOString();

            // 1. Defensive Copy
            const dataCopy = JSON.parse(JSON.stringify(data));

            // Auto-populate metadata on the copy
            if (!dataCopy.metadata) {
                dataCopy.metadata = {
                    tags: [],
                };
            }

            const { error } = await supabase
                .from('licitaciones')
                .upsert({
                    hash,
                    file_name: fileName,
                    data: dataCopy,
                    updated_at: now
                }, { onConflict: 'user_id, hash' });

            if (error) {
                if (error.code === '42501') {
                    return err(new Error("Persistencia Bloqueada: Falta iniciar sesión o configurar permisos (RLS)."));
                }
                return err(new Error(error.message));
            }

            return ok(undefined);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async updateLicitacion(hash: string, data: LicitacionData): Promise<Result<void>> {
        try {
            const now = new Date().toISOString();

            const { error } = await supabase
                .from('licitaciones')
                .update({
                    data: data,
                    updated_at: now
                })
                .eq('hash', hash);

            if (error) return err(new Error(error.message));
            return ok(undefined);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async getLicitacion(hash: string): Promise<Result<DbLicitacion>> {
        try {
            const { data, error } = await supabase
                .from('licitaciones')
                .select('*')
                .eq('hash', hash)
                .single();

            if (error) return err(new Error(error.message));

            return ok({
                hash: data.hash as string,
                fileName: data.file_name as string,
                timestamp: new Date(data.updated_at as string).getTime(),
                data: data.data as LicitacionData,
                metadata: (data.data as LicitacionData).metadata || { tags: [] }
            });
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async getAllLicitaciones(): Promise<Result<DbLicitacion[]>> {
        try {
            const { data, error } = await supabase
                .from('licitaciones')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) return err(new Error(error.message));

            const results: DbLicitacion[] = (data || []).map(item => ({
                hash: item.hash as string,
                fileName: item.file_name as string,
                timestamp: new Date(item.updated_at as string).getTime(),
                data: item.data as LicitacionData,
                metadata: (item.data as LicitacionData).metadata || { tags: [] }
            }));

            return ok(results);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async deleteLicitacion(hash: string): Promise<Result<void>> {
        try {
            const { error } = await supabase
                .from('licitaciones')
                .delete()
                .eq('hash', hash);

            if (error) return err(new Error(error.message));
            return ok(undefined);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async advancedSearch(filters: SearchFilters): Promise<Result<DbLicitacion[]>> {
        try {
            let query = supabase.from('licitaciones').select('*');

            if (filters.presupuestoMin !== undefined) {
                query = query.filter('data->datosGenerales->>presupuesto', 'gte', filters.presupuestoMin);
            }

            if (filters.presupuestoMax !== undefined) {
                query = query.filter('data->datosGenerales->>presupuesto', 'lte', filters.presupuestoMax);
            }

            if (filters.estado) {
                query = query.filter('data->metadata->>estado', 'eq', filters.estado);
            }

            const { data, error } = await query;
            if (error) return err(new Error(error.message));

            let results: DbLicitacion[] = (data || []).map(item => ({
                hash: item.hash as string,
                fileName: item.file_name as string,
                timestamp: new Date(item.updated_at as string).getTime(),
                data: item.data as LicitacionData,
                metadata: (item.data as LicitacionData).metadata || { tags: [] }
            }));

            if (filters.tags && filters.tags.length > 0) {
                results = results.filter(item =>
                    item.data.metadata?.tags?.some(tag => filters.tags!.includes(tag))
                );
            }

            if (filters.cliente) {
                results = results.filter(item =>
                    item.data.metadata?.cliente?.toLowerCase().includes(filters.cliente!.toLowerCase())
                );
            }

            if (filters.fechaDesde) {
                results = results.filter(item => item.timestamp >= filters.fechaDesde!);
            }

            if (filters.fechaHasta) {
                results = results.filter(item => item.timestamp <= filters.fechaHasta!);
            }

            return ok(results);
        } catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    subscribeToLicitacion(hash: string, onUpdate: (data: LicitacionData) => void) {
        return supabase
            .channel(`licitacion:${hash}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'licitaciones',
                    filter: `hash=eq.${hash}`
                },
                (payload) => {
                    if (payload.new && payload.new.data) {
                        onUpdate(payload.new.data as LicitacionData);
                    }
                }
            )
            .subscribe();
    }
}

export const dbService = new DBService();
