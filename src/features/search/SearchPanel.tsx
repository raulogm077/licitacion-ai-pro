import { useState, useMemo } from 'react';
import { SearchFilters } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Search, Filter, X, Calendar, Euro, Tag as TagIcon } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { COMMON_TAGS } from '../../constants/tags';

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

    const suggestedTags = useMemo(() => {
        // Cache selected tags as a Set for O(1) lookups
        const selectedTagsSet = new Set(filters.tags || []);
        return COMMON_TAGS.filter(tag => !selectedTagsSet.has(tag)).slice(0, 8);
    }, [filters.tags]);

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
                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        {/* Presupuesto Range */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                                    <Euro size={14} />
                                    Presupuesto Mínimo
                                </label>
                                <input
                                    type="number"
                                    value={filters.presupuestoMin || ''}
                                    onChange={(e) => handleFilterChange('presupuestoMin', e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder="0"
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                                    <Euro size={14} />
                                    Presupuesto Máximo
                                </label>
                                <input
                                    type="number"
                                    value={filters.presupuestoMax || ''}
                                    onChange={(e) => handleFilterChange('presupuestoMax', e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder="1000000"
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Fecha Range */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                                    <Calendar size={14} />
                                    Fecha Desde
                                </label>
                                <input
                                    type="date"
                                    value={filters.fechaDesde ? new Date(filters.fechaDesde).toISOString().split('T')[0] : ''}
                                    onChange={(e) => handleFilterChange('fechaDesde', e.target.value ? new Date(e.target.value).getTime() : undefined)}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                                    <Calendar size={14} />
                                    Fecha Hasta
                                </label>
                                <input
                                    type="date"
                                    value={filters.fechaHasta ? new Date(filters.fechaHasta).toISOString().split('T')[0] : ''}
                                    onChange={(e) => handleFilterChange('fechaHasta', e.target.value ? new Date(e.target.value).getTime() : undefined)}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Estado */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Estado
                            </label>
                            <select
                                value={filters.estado || ''}
                                onChange={(e) => handleFilterChange('estado', e.target.value || undefined)}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:text-white"
                            >
                                <option value="">Todos</option>
                                <option value="PENDIENTE">Pendiente</option>
                                <option value="EN_REVISION">En Revisión</option>
                                <option value="ADJUDICADA">Adjudicada</option>
                                <option value="DESCARTADA">Descartada</option>
                            </select>
                        </div>

                        {/* Tags */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                                <TagIcon size={14} />
                                Tags
                            </label>

                            {/* Selected Tags */}
                            {filters.tags && filters.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {filters.tags.map((tag, idx) => (
                                        <Badge key={idx} variant="default" className="flex items-center gap-1">
                                            {tag}
                                            <button onClick={() => removeTag(tag)} className="ml-1">
                                                <X size={12} />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}

                            {/* Tag Suggestions */}
                            <div className="flex flex-wrap gap-2">
                                {suggestedTags.map((tag, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => addTag(tag)}
                                        className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:border-brand-500 transition-colors"
                                    >
                                        + {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
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
