import React, { useState, lazy, Suspense } from 'react';
import { Card } from '../components/ui/Card';
import { LicitacionData, SearchFilters } from '../types';
import { dbService } from '../services/db.service';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SearchPanel = lazy(() => import('../features/search/SearchPanel').then(m => ({ default: m.SearchPanel })));

interface SearchPageProps {
    handleHistorySelect: (data: LicitacionData, hash?: string) => void;
}



export const SearchPage: React.FC<SearchPageProps> = ({ handleHistorySelect }) => {
    const navigate = useNavigate();
    const handleSelect = (data: LicitacionData, hash?: string) => {
        handleHistorySelect(data, hash);
        navigate('/');
    };
    const [searchResults, setSearchResults] = useState<{ data: LicitacionData; hash: string }[]>([]);

    const handleSearch = async (filters: SearchFilters) => {
        try {
            const results = await dbService.advancedSearch(filters);
            setSearchResults(results);
        } catch (error) {
            console.error('Search failed:', error);
            setSearchResults([]);
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
