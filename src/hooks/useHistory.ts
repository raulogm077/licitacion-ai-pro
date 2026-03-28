import { useState, useEffect, useCallback } from 'react';
import { services } from '../config/service-registry';
import { LicitacionData, SearchFilters } from '../types';
import { logger } from '../services/logger';

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

    const loadHistory = useCallback(async (filters: SearchFilters = {}) => {
        setLoading(true);
        setActiveFilters(filters);

        let result;
        // If no filters are applied, use getAllLicitaciones, else use advancedSearch
        if (Object.keys(filters).length === 0) {
            result = await services.db.getAllLicitaciones();
        } else {
            result = await services.db.advancedSearch(filters);
        }

        if (result.ok) {
            // Sort by timestamp desc
            const sorted = result.value.sort((a: HistoryItem, b: HistoryItem) => b.timestamp - a.timestamp);
            setItems(sorted);
            setError(null);
        } else {
            logger.error('Failed to load history:', result.error);
            setError('Error al cargar el historial. Por favor intente nuevamente.');
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    return {
        items,
        loading,
        error,
        refresh: () => loadHistory(activeFilters),
        applyFilters: loadHistory,
        activeFilters,
    };
}
