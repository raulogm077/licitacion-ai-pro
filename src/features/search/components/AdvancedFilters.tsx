import { X, Calendar, Euro, Tag as TagIcon } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { COMMON_TAGS } from '../../../constants/tags';
import { SearchFilters } from '../../../types';

interface AdvancedFiltersProps {
    filters: SearchFilters;
    handleFilterChange: (key: keyof SearchFilters, value: string | number | string[] | undefined) => void;
    addTag: (tag: string) => void;
    removeTag: (tag: string) => void;
}

export function AdvancedFilters({ filters, handleFilterChange, addTag, removeTag }: AdvancedFiltersProps) {
    return (
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
                    {COMMON_TAGS.filter(tag => !filters.tags?.includes(tag)).slice(0, 8).map((tag, idx) => (
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
    );
}
