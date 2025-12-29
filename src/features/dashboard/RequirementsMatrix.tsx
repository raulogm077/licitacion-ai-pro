import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { CheckSquare, Square, ListChecks, Quote } from 'lucide-react';
import { LicitacionData } from '../../types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/Tooltip';

interface RequirementsMatrixProps {
    requirements: LicitacionData['requisitosTecnicos']['funcionales'];
}

type FilterType = 'ALL' | 'MANDATORY' | 'OPTIONAL';

export function RequirementsMatrix({ requirements }: RequirementsMatrixProps) {
    const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
    const [filter, setFilter] = useState<FilterType>('ALL');

    const toggleItem = (index: number) => {
        setCheckedItems(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    const filteredRequirements = useMemo(() => {
        return requirements.filter(req => {
            if (filter === 'MANDATORY') return req.obligatorio;
            if (filter === 'OPTIONAL') return !req.obligatorio;
            return true;
        });
    }, [requirements, filter]);

    const progress = useMemo(() => {
        const total = requirements.length;
        if (total === 0) return 0;
        const checkedCount = Object.values(checkedItems).filter(Boolean).length;
        return Math.round((checkedCount / total) * 100);
    }, [requirements, checkedItems]);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <ListChecks size={20} className="text-brand-600" />
                        Matriz de Requisitos
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{progress}% Cumplimiento</span>
                        <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-brand-500 transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mt-4">
                    <button
                        onClick={() => setFilter('ALL')}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filter === 'ALL' ? 'bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => setFilter('MANDATORY')}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filter === 'MANDATORY' ? 'bg-brand-600 text-white' : 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50'
                            }`}
                    >
                        Obligatorios
                    </button>
                    <button
                        onClick={() => setFilter('OPTIONAL')}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filter === 'OPTIONAL' ? 'bg-slate-600 dark:bg-slate-400 dark:text-slate-950 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                    >
                        Opcionales
                    </button>
                </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-0">
                <div className="divide-y divide-slate-100">
                    {filteredRequirements.map((req) => {
                        // We need a stable ID, but for now index in filtered list is risky if list changes. 
                        // Ideally we'd map back to original index or have IDs. 
                        // For this MVP, we'll find the index in the original array to use as key for state.
                        const originalIndex = requirements.indexOf(req);
                        const isChecked = checkedItems[originalIndex] || false;

                        return (
                            <div
                                key={originalIndex}
                                className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 transition-colors cursor-pointer flex gap-3 group ${isChecked ? 'bg-brand-50/30' : ''}`}
                                onClick={() => toggleItem(originalIndex)}
                            >
                                <div className={`mt-0.5 text-slate-400 group-hover:text-brand-500 transition-colors ${isChecked ? 'text-brand-600' : ''}`}>
                                    {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <p className={`text-sm font-medium transition-colors ${isChecked ? 'text-slate-500 dark:text-slate-500 line-through' : 'text-slate-900 dark:text-slate-200'}`}>
                                            {req.requisito}
                                        </p>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant={req.obligatorio ? 'default' : 'outline'} className="text-[10px]">
                                                {req.obligatorio ? 'Obligatorio' : 'Opcional'}
                                            </Badge>
                                            {req.cita && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors" onClick={(e) => e.stopPropagation()}>
                                                                <Quote size={12} className="text-slate-400 hover:text-brand-500" />
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs text-xs italic bg-slate-800 text-white border-slate-700">
                                                            "{req.cita}"
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </div>
                                    </div>
                                    {req.referenciaPagina && (
                                        <p className="text-xs text-slate-400 dark:text-slate-500">Pág. {req.referenciaPagina}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {filteredRequirements.length === 0 && (
                        <div className="p-8 text-center text-slate-500 text-sm">
                            No hay requisitos que coincidan con el filtro.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
