import { useState, useMemo } from 'react';
import { SearchFilters } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Search, Filter } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { AdvancedFilters } from './components/AdvancedFilters';

interface SearchPanelProps {
    onSearch: (filters: SearchFilters) => void;
    onReset: () => void;
}

export function SearchPanel({ onSearch, onReset }: SearchPanelProps) {
    const [filters, setFilters] = useState<SearchFilters>({});
    const [showAdvanced, setShowAdvanced] = useState(false);

    const handleFilterChange = (key: keyof SearchFilters, value: string | number | string[] | undefined) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleSearch = () => {
        onSearch(filters);
    };

    const handleReset = () => {
        setFilters({});
        onReset();
    };

    const addTag = (tag: string) => {
        const currentTags = filters.tags || [];
        if (!currentTags.includes(tag)) {
            handleFilterChange('tags', [...currentTags, tag]);
        }
    };

    const removeTag = (tag: string) => {
        const currentTags = filters.tags || [];
        handleFilterChange('tags', currentTags.filter(t => t !== tag));
    };

    const activeFilterCount = useMemo(() => {
        return Object.values(filters).filter(v => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)).length;
    }, [filters]);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Search size={20} className="text-brand-600" />
                        Búsqueda Avanzada
                    </CardTitle>
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                    >
                        <Filter size={16} />
                        {showAdvanced ? 'Ocultar filtros' : 'Mostrar filtros'}
                        {activeFilterCount > 0 && (
                            <Badge variant="default" className="text-xs">
                                {activeFilterCount}
                            </Badge>
                        )}
                    </button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Basic Search */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Cliente
                    </label>
                    <input
                        type="text"
                        value={filters.cliente || ''}
                        onChange={(e) => handleFilterChange('cliente', e.target.value)}
                        placeholder="Buscar por cliente..."
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:text-white"
                    />
                </div>

                {/* Advanced Filters */}
                {showAdvanced && (
                    <AdvancedFilters
                        filters={filters}
                        handleFilterChange={handleFilterChange}
                        addTag={addTag}
                        removeTag={removeTag}
                    />
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                    <button
                        onClick={handleSearch}
                        className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Search size={16} />
                        Buscar
                    </button>
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                    >
                        Limpiar
                    </button>
                </div>
            </CardContent>
        </Card>
    );
}
