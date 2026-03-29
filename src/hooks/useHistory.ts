import { useState, useEffect, useCallback, useRef } from 'react';
import { services } from '../config/service-registry';
import { LicitacionData, SearchFilters } from '../types';
import { logger } from '../services/logger';

const SEARCH_DEBOUNCE_MS = 300;

export interface HistoryItem {
    hash: string;
    fileName: string;
    timestamp: number;
    data: LicitacionData;
}

export function useHistory() {
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeFilters, setActiveFilters] = useState<SearchFilters>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [deleting, setDeleting] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    const loadHistory = useCallback(async (filters: SearchFilters = {}) => {
        setLoading(true);
        setActiveFilters(filters);

        let result;
        if (Object.keys(filters).length === 0) {
            result = await services.db.getAllLicitaciones();
        } else {
            result = await services.db.advancedSearch(filters);
        }

        if (result.ok) {
            const sorted = result.value.sort((a: HistoryItem, b: HistoryItem) => b.timestamp - a.timestamp);
            setItems(sorted);
            setError(null);
        } else {
            logger.error('Failed to load history:', result.error);
            setError('Error al cargar el historial. Por favor intente nuevamente.');
        }
        setLoading(false);
    }, []);

    const search = useCallback(
        async (query: string) => {
            setSearchQuery(query);
            const trimmed = query.trim();

            // Debounce: wait 300ms after last keystroke
            if (debounceRef.current) clearTimeout(debounceRef.current);

            if (!trimmed) {
                loadHistory(activeFilters);
                return;
            }

            debounceRef.current = setTimeout(async () => {
                setLoading(true);
                const result = await services.db.searchLicitaciones(trimmed);
                if (result.ok) {
                    setItems(result.value);
                    setError(null);
                } else {
                    logger.error('Search failed:', result.error);
                    setError('Error en la búsqueda.');
                }
                setLoading(false);
            }, SEARCH_DEBOUNCE_MS);
        },
        [activeFilters, loadHistory]
    );

    const deleteLicitacion = useCallback(async (hash: string) => {
        setDeleting(hash);
        const result = await services.db.deleteLicitacion(hash);
        if (result.ok) {
            setItems((prev) => prev.filter((item) => item.hash !== hash));
        } else {
            logger.error('Delete failed:', result.error);
            setError('Error al eliminar el registro.');
        }
        setDeleting(null);
        return result.ok;
    }, []);

    useEffect(() => {
        loadHistory();
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [loadHistory]);

    return {
        items,
        loading,
        error,
        searchQuery,
        deleting,
        refresh: () => (searchQuery ? search(searchQuery) : loadHistory(activeFilters)),
        applyFilters: loadHistory,
        search,
        deleteLicitacion,
        activeFilters,
    };
}
