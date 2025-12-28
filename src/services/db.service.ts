import { supabase } from '../config/supabase';
import { LicitacionData, SearchFilters } from '../types';

export class DBService {

    async saveLicitacion(hash: string, fileName: string, data: LicitacionData) {
        const now = new Date().toISOString();

        // Auto-populate metadata
        if (!data.metadata) {
            data.metadata = {
                tags: [],
                // backend handles created_at/updated_at, but we keep structure consistent
            };
        }

        const { error } = await supabase
            .from('licitaciones')
            .upsert({
                hash,
                file_name: fileName,
                data: data,
                updated_at: now
            }, { onConflict: 'user_id, hash' });

        if (error) throw error;
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
        // Supabase array contains logic for JSONB is complex, 
        // simpler to fetch all and filter client side OR use Postgres operators if indexed.
        // For now, client side filtering for robust implementation without custom functions
        const all = await this.getAllLicitaciones();
        return all.filter(item =>
            item.data.metadata?.tags?.some(tag => tags.includes(tag))
        );
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

        if (filters.presupuestoMin !== undefined) {
            query = query.filter('data->datosGenerales->>presupuesto', 'gte', filters.presupuestoMin);
        }

        if (filters.presupuestoMax !== undefined) {
            query = query.filter('data->datosGenerales->>presupuesto', 'lte', filters.presupuestoMax);
        }

        // Client side filtering for complex JSONB matches (like nested tags/cliente/fechas) 
        // to avoid complex SQL or function RPCs for this iteration.
        // We get candidates from DB (maybe reduced by budget) then filter.

        const { data, error } = await query;
        if (error) throw error;

        let results = data.map(item => ({
            hash: item.hash,
            fileName: item.file_name,
            timestamp: new Date(item.updated_at).getTime(),
            data: item.data as LicitacionData
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

        if (filters.estado) {
            results = results.filter(item => item.data.metadata?.estado === filters.estado);
        }

        return results;
    }
}

export const dbService = new DBService();
