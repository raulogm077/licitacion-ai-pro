import React from 'react';
import { Loader2, Plus, Edit2, Trash2, Copy, FileText } from 'lucide-react';
import { ExtractionTemplate } from '../../../types';

interface TemplateListProps {
    templates: ExtractionTemplate[];
    loading: boolean;
    isSubmitting: boolean;
    onEdit: (template: ExtractionTemplate) => void;
    onDuplicate: (template: ExtractionTemplate) => void;
    onDelete: (id: string) => void;
    onCreate: () => void;
}

export const TemplateList: React.FC<TemplateListProps> = ({
    templates,
    loading,
    isSubmitting,
    onEdit,
    onDuplicate,
    onDelete,
    onCreate,
}) => (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
            <div className="p-12 flex justify-center items-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
        ) : templates.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Aún no hay plantillas</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">
                    Las plantillas te permiten definir exactamente qué información debe extraer la IA de los pliegos de
                    licitación.
                </p>
                <button
                    onClick={onCreate}
                    className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm transition-colors flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Crear mi primera plantilla
                </button>
            </div>
        ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {templates.map((template) => (
                    <div
                        key={template.id}
                        className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between"
                    >
                        <div className="flex-1 pr-8">
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {template.name}
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800">
                                    {template.schema?.length || 0} campos
                                </span>
                            </div>
                            {template.description && (
                                <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2">
                                    {template.description}
                                </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                                {template.schema?.slice(0, 5).map((f) => (
                                    <span
                                        key={f.id}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-mono"
                                    >
                                        {f.name}
                                        {f.required && <span className="text-red-500">*</span>}
                                    </span>
                                ))}
                                {(template.schema?.length || 0) > 5 && (
                                    <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 text-xs">
                                        +{template.schema!.length - 5} más
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onDuplicate(template)}
                                disabled={isSubmitting}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg transition-all shadow-sm"
                                title="Duplicar"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onEdit(template)}
                                disabled={isSubmitting}
                                className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-800 rounded-lg transition-all shadow-sm"
                                title="Editar"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onDelete(template.id)}
                                disabled={isSubmitting}
                                className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-800 rounded-lg transition-all shadow-sm"
                                title="Eliminar"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);
