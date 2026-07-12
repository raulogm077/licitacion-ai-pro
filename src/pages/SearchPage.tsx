import React, { useState, lazy, Suspense } from 'react';
import { Card } from '../components/ui/Card';
import { unwrap } from '../lib/tracked-field';
import { formatCurrency } from '../lib/formatters';
import { LicitacionData, SearchFilters, DbLicitacion } from '../types';
import { Loader2, SearchX, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLicitacionStore } from '../stores/licitacion.store';
import { services } from '../config/service-registry';
import { logger } from '../services/logger';

const SearchPanel = lazy(() => import('../features/search/SearchPanel').then((m) => ({ default: m.SearchPanel })));

/** Defensive budget formatting: missing currency falls back to EUR and a
 *  non-numeric budget renders as a dash instead of `NaN €` (or crashing
 *  Intl.NumberFormat with `currency: undefined`). */
function formatBudget(data: LicitacionData): string {
    const presupuesto = unwrap(data.datosGenerales.presupuesto);
    const moneda = unwrap(data.datosGenerales.moneda) || 'EUR';
    const amount = typeof presupuesto === 'string' ? Number(presupuesto) : presupuesto;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
    return formatCurrency(amount, moneda);
}

export const SearchPage: React.FC = () => {
    const navigate = useNavigate();
    const { loadLicitacion } = useLicitacionStore();
    const [searchResults, setSearchResults] = useState<DbLicitacion[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    const handleSelect = (data: LicitacionData, hash?: string) => {
        loadLicitacion(data, hash);
        navigate('/');
    };

    const handleSearch = async (filters: SearchFilters) => {
        setIsSearching(true);
        setSearchError(null);
        const result = await services.db.advancedSearch(filters);
        setIsSearching(false);
        setHasSearched(true);
        if (result.ok) {
            setSearchResults(result.value);
        } else {
            logger.error('Search failed:', result.error);
            setSearchResults([]);
            setSearchError('No se pudo completar la búsqueda. Inténtalo de nuevo.');
        }
    };

    const handleSearchReset = () => {
        setSearchResults([]);
        setHasSearched(false);
        setSearchError(null);
    };

    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center p-10">
                    <Loader2 className="animate-spin" />
                </div>
            }
        >
            <div className="space-y-6">
                {/* Search Panel */}
                <SearchPanel onSearch={handleSearch} onReset={handleSearchReset} />

                {/* Loading state */}
                {isSearching && (
                    <div
                        className="flex items-center justify-center gap-2 p-8 text-slate-500 dark:text-slate-400"
                        role="status"
                        aria-live="polite"
                    >
                        <Loader2 className="animate-spin" size={18} />
                        <span>Buscando…</span>
                    </div>
                )}

                {/* Error state */}
                {searchError && !isSearching && (
                    <div
                        className="flex items-center gap-2 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300"
                        role="alert"
                    >
                        <AlertCircle size={18} />
                        <span>{searchError}</span>
                    </div>
                )}

                {/* Empty state */}
                {hasSearched && !isSearching && !searchError && searchResults.length === 0 && (
                    <div className="flex flex-col items-center gap-2 p-10 text-center text-slate-500 dark:text-slate-400">
                        <SearchX size={28} />
                        <p className="font-medium">Sin resultados</p>
                        <p className="text-sm">Prueba con otros términos o amplía los filtros.</p>
                    </div>
                )}

                {/* Search Results */}
                {!isSearching && searchResults.length > 0 && (
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
                                            {unwrap(result.data.datosGenerales.titulo)}
                                        </h4>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {result.data.metadata?.tags?.map((tag: string, idx: number) => (
                                                <span
                                                    key={idx}
                                                    className="text-xs px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {formatBudget(result.data)}
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
