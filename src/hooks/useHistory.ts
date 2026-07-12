import { useState, useEffect, useCallback, useRef } from 'react';
import { services } from '../config/service-registry';
import { LicitacionData, SearchFilters } from '../types';
import { applyClientFilters } from '../lib/search-filters';
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
    // Mirrors searchQuery for stable callbacks (loadHistory must not change
    // identity on every keystroke — the mount effect depends on it).
    const searchQueryRef = useRef('');

    /**
     * Single refresh path composing free text and filters so the two UI
     * controls never silently discard each other:
     *   - only text  → server-side FTS
     *   - only filters → server-side advancedSearch
     *   - both → FTS by text, then filters applied in memory on the result
     */
    const fetchItems = useCallback(async (query: string, filters: SearchFilters) => {
        setLoading(true);

        const trimmed = query.trim();
        const hasFilters = Object.keys(filters).length > 0;

        let result;
        if (trimmed) {
            result = await services.db.searchLicitaciones(trimmed);
            if (result.ok && hasFilters) {
                result = { ok: true as const, value: applyClientFilters(result.value, filters) };
            }
        } else if (hasFilters) {
            result = await services.db.advancedSearch(filters);
        } else {
            result = await services.db.getAllLicitaciones();
        }

        if (result.ok) {
            const sorted = [...result.value].sort((a: HistoryItem, b: HistoryItem) => b.timestamp - a.timestamp);
            setItems(sorted);
            setError(null);
        } else {
            logger.error('Failed to load history:', result.error);
            setError('Error al cargar el historial. Por favor intente nuevamente.');
        }
        setLoading(false);
    }, []);

    const loadHistory = useCallback(
        async (filters: SearchFilters = {}) => {
            setActiveFilters(filters);
            await fetchItems(searchQueryRef.current, filters);
        },
        [fetchItems]
    );

    const search = useCallback(
        (query: string) => {
            setSearchQuery(query);
            searchQueryRef.current = query;

            // Debounce: wait 300ms after last keystroke
            if (debounceRef.current) clearTimeout(debounceRef.current);

            if (!query.trim()) {
                fetchItems('', activeFilters);
                return;
            }

            debounceRef.current = setTimeout(() => {
                fetchItems(query, activeFilters);
            }, SEARCH_DEBOUNCE_MS);
        },
        [activeFilters, fetchItems]
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
        refresh: () => fetchItems(searchQuery, activeFilters),
        applyFilters: loadHistory,
        search,
        deleteLicitacion,
        activeFilters,
    };
}
