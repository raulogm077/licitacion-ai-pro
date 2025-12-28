import { useState, useEffect } from 'react';
import { services } from '../config/service-registry';
import { LicitacionData } from '../types';

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

    const loadHistory = async () => {
        setLoading(true);
        const result = await services.db.getAllLicitaciones();
        if (result.ok) {
            // Sort by timestamp desc
            const sorted = result.value.sort((a: HistoryItem, b: HistoryItem) => b.timestamp - a.timestamp);
            setItems(sorted);
            setError(null);
        } else {
            console.error("Failed to load history:", result.error);
            setError("Error al cargar el historial. Por favor intente nuevamente.");
        }
        setLoading(false);
    };

    useEffect(() => {
        loadHistory();
    }, []);

    return { items, loading, error, refresh: loadHistory };
}
