import { supabase } from '../config/supabase';
import { LicitacionData, SearchFilters } from '../types';

export class DBService {

    async saveLicitacion(hash: string, fileName: string, data: LicitacionData) {
        // 0. Explicit Auth Check
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.warn("⚠️ Intento de guardado sin sesión activa.");
            throw new Error("Persistencia Bloqueada: No hay sesión activa.");
        }

        const now = new Date().toISOString();

        // 1. Defensive Copy
        const dataCopy = JSON.parse(JSON.stringify(data));

        // Auto-populate metadata on the copy
        if (!dataCopy.metadata) {
            dataCopy.metadata = {
                tags: [],
                // backend handles created_at/updated_at, but we keep structure consistent
            };
        }

        console.log("📤 Supabase: Intentando guardar licitación...", { hash, fileName });

        try {
            const { error } = await supabase
                .from('licitaciones')
                .upsert({
                    hash,
                    file_name: fileName,
                    data: dataCopy,
                    updated_at: now
                }, { onConflict: 'user_id, hash' });

            if (error) {
                console.error("❌ Supabase Error:", error);

                if (error.code === '42501') {
                    throw new Error("Persistencia Bloqueada: Falta iniciar sesión o configurar permisos (RLS).");
                }

                throw error;
            }

            console.log("✅ Supabase: Licitación guardada exitosamente");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("❌ Error guardando licitación:", err.message);
            // Re-throw so UI can display toast
            throw err;
        }
    }

    async updateLicitacion(hash: string, data: LicitacionData) {
        const now = new Date().toISOString();

        const { error } = await supabase
            .from('licitaciones')
            .update({
                data: data,
                updated_at: now
            })
            .eq('hash', hash);

        if (error) throw error;
    }

    async getLicitacion(hash: string) {
        const { data, error } = await supabase
            .from('licitaciones')
            .select('*')
            .eq('hash', hash)
            .single();

        if (error) return undefined;
        return {
            hash: data.hash,
            fileName: data.file_name,
            timestamp: new Date(data.updated_at).getTime(),
            data: data.data as LicitacionData
        };
    }

    async getAllLicitaciones() {
        const { data, error } = await supabase
            .from('licitaciones')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return data.map(item => ({
            hash: item.hash,
            fileName: item.file_name,
            timestamp: new Date(item.updated_at).getTime(),
            data: item.data as LicitacionData
        }));
    }

    async deleteLicitacion(hash: string) {
        const { error } = await supabase
            .from('licitaciones')
            .delete()
            .eq('hash', hash);

        if (error) throw error;
    }

    async searchByTags(tags: string[]) {
        // Use Postgres JSONB operators for efficient server-side filtering
        // data->metadata->tags @> ["tag1", "tag2"]
        // This finds rows where tags array contains ALL the search tags (AND logic).
        // If we want OR logic, we'd need a different approach, but search is usually restrictive.

        // Supabase 'contains' operator works for JSONB arrays
        const { data, error } = await supabase
            .from('licitaciones')
            .select('*')
            .contains('data->metadata->tags', tags);

        if (error) throw error;

        return data.map(item => ({
            hash: item.hash,
            fileName: item.file_name,
            timestamp: new Date(item.updated_at).getTime(),
            data: item.data as LicitacionData
        }));
    }

    async searchByPresupuestoRange(min: number, max: number) {
        // Can utilize JSONB queries
        const { data, error } = await supabase
            .from('licitaciones')
            .select('*')
            .filter('data->datosGenerales->>presupuesto', 'gte', min)
            .filter('data->datosGenerales->>presupuesto', 'lte', max);

        if (error) throw error;
        return data.map(item => ({
            hash: item.hash,
            fileName: item.file_name,
            timestamp: new Date(item.updated_at).getTime(),
            data: item.data as LicitacionData
        }));
    }

    async advancedSearch(filters: SearchFilters) {
        let query = supabase.from('licitaciones').select('*');

        // Server-side filtering using JSONB arrows
        if (filters.presupuestoMin !== undefined) {
            // Note: This relies on Supabase/Postgres casting. 
            // If explicit casting is needed, might need a view or RPC, but let's try direct JSON arrow filter.
            // Postgres 42501 or casting error might occur if 'presupuesto' is not consistent number, but schema validates it.
            query = query.filter('data->datosGenerales->>presupuesto', 'gte', filters.presupuestoMin);
        }

        if (filters.presupuestoMax !== undefined) {
            query = query.filter('data->datosGenerales->>presupuesto', 'lte', filters.presupuestoMax);
        }

        if (filters.estado) {
            query = query.filter('data->metadata->>estado', 'eq', filters.estado);
        }

        const { data, error } = await query;
        if (error) throw error;

        let results = data.map(item => ({
            hash: item.hash,
            fileName: item.file_name,
            timestamp: new Date(item.updated_at).getTime(),
            data: item.data as LicitacionData
        }));

        // Client side filtering for remaining complex JSONB matchers (Arrays, LIKE)
        // Ideally we'd use .contains for tags, but let's keep it safe client-side for now as agreed in Plan.

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

        return results;
    }
}

export const dbService = new DBService();
