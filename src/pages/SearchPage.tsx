import React, { useState, lazy, Suspense } from 'react';
import { Card } from '../components/ui/Card';
import { LicitacionData, SearchFilters, DbLicitacion } from '../types';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLicitacionStore } from '../stores/licitacion.store';
import { services } from '../config/service-registry';
import { logger } from '../services/logger';

const SearchPanel = lazy(() => import('../features/search/SearchPanel').then(m => ({ default: m.SearchPanel })));

export const SearchPage: React.FC = () => {
    const navigate = useNavigate();
    const { loadLicitacion } = useLicitacionStore();
    const [searchResults, setSearchResults] = useState<DbLicitacion[]>([]);

    const handleSelect = (data: LicitacionData, hash?: string) => {
        loadLicitacion(data, hash);
        navigate('/');
    };

    const handleSearch = async (filters: SearchFilters) => {
        const result = await services.db.advancedSearch(filters);
        if (result.ok) {
            setSearchResults(result.value);
        } else {
            logger.error('Search failed:', result.error);
            setSearchResults([]);
            // Could add a toast here in the future
        }
    };

    const handleSearchReset = () => {
        setSearchResults([]);
    };

    return (
        <Suspense fallback={<div className="flex items-center justify-center p-10"><Loader2 className="animate-spin" /></div>}>
            <div className="space-y-6">
                {/* Search Panel */}
                <SearchPanel onSearch={handleSearch} onReset={handleSearchReset} />

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Resultados ({searchResults.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {searchResults.map((result) => (
                                <Card
                                    key={result.hash}
                                    className="cursor-pointer hover:shadow-lg transition-shadow"
                                    onClick={() => handleSelect(result.data, result.hash)}
                                >
                                    <div className="p-4">
                                        <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                                            {result.data.datosGenerales.titulo}
                                        </h4>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {result.data.metadata?.tags?.map((tag: string, idx: number) => (
                                                <span key={idx} className="text-xs px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: result.data.datosGenerales.moneda }).format(result.data.datosGenerales.presupuesto)}
                                        </p>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Suspense>
    );
};
