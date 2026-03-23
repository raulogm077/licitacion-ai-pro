import React from 'react';
import { Loader2 } from 'lucide-react';
import { ExtractionTemplate, TemplateField } from '../../../types';
import { TemplateFieldEditor } from './TemplateFieldEditor';

interface TemplateFormProps {
    template: Partial<ExtractionTemplate>;
    isSubmitting: boolean;
    onSave: (e: React.FormEvent) => void;
    onCancel: () => void;
    onUpdateTemplate: (updates: Partial<ExtractionTemplate>) => void;
    onAddField: () => void;
    onUpdateField: (id: string, updates: Partial<TemplateField>) => void;
    onRemoveField: (id: string) => void;
}

export const TemplateForm: React.FC<TemplateFormProps> = ({
    template,
    isSubmitting,
    onSave,
    onCancel,
    onUpdateTemplate,
    onAddField,
    onUpdateField,
    onRemoveField,
}) => (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <form onSubmit={onSave} className="p-6">
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                        {template.id ? 'Editar Plantilla' : 'Crear Nueva Plantilla'}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Nombre de la Plantilla *
                            </label>
                            <input
                                type="text"
                                required
                                value={template.name || ''}
                                onChange={(e) => onUpdateTemplate({ name: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                                placeholder="Ej. Análisis de Software"
                            />
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Descripción
                            </label>
                            <input
                                type="text"
                                value={template.description || ''}
                                onChange={(e) => onUpdateTemplate({ description: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                                placeholder="Breve descripción de su propósito..."
                            />
                        </div>
                    </div>
                </div>

                <TemplateFieldEditor
                    fields={template.schema || []}
                    onAddField={onAddField}
                    onUpdateField={onUpdateField}
                    onRemoveField={onRemoveField}
                />
            </div>

            <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Guardar Plantilla
                </button>
            </div>
        </form>
    </div>
);
