import React from 'react';
import { Plus, Trash2, FileText } from 'lucide-react';
import { TemplateField } from '../../../types';

interface TemplateFieldEditorProps {
    fields: TemplateField[];
    onAddField: () => void;
    onUpdateField: (id: string, updates: Partial<TemplateField>) => void;
    onRemoveField: (id: string) => void;
}

export const TemplateFieldEditor: React.FC<TemplateFieldEditorProps> = ({
    fields,
    onAddField,
    onUpdateField,
    onRemoveField,
}) => (
    <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
            <h4 className="text-md font-semibold text-slate-900 dark:text-white">Campos a Extraer</h4>
            <button
                type="button"
                onClick={onAddField}
                className="text-sm flex items-center gap-1 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium"
            >
                <Plus className="w-4 h-4" />
                Añadir Campo
            </button>
        </div>

        {fields.length === 0 ? (
            <div className="text-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                <FileText className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">No hay campos definidos.</p>
                <button type="button" onClick={onAddField} className="mt-2 text-brand-600 font-medium hover:underline">
                    Añade el primer campo
                </button>
            </div>
        ) : (
            <div className="space-y-3">
                {fields.map((field, index) => (
                    <div
                        key={field.id}
                        className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg flex gap-4 items-start"
                    >
                        <div className="mt-2 text-slate-400 font-mono text-sm">{index + 1}.</div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3">
                            <div className="md:col-span-4">
                                <input
                                    type="text"
                                    required
                                    placeholder="Nombre del campo"
                                    value={field.name}
                                    onChange={(e) => onUpdateField(field.id, { name: e.target.value })}
                                    className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <select
                                    value={field.type}
                                    onChange={(e) =>
                                        onUpdateField(field.id, { type: e.target.value as TemplateField['type'] })
                                    }
                                    className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                >
                                    <option value="texto">Texto</option>
                                    <option value="numero">Número</option>
                                    <option value="fecha">Fecha</option>
                                    <option value="lista">Lista</option>
                                    <option value="booleano">Booleano (Sí/No)</option>
                                </select>
                            </div>
                            <div className="md:col-span-5 flex items-center gap-3">
                                <input
                                    type="text"
                                    placeholder="Instrucción (opcional)"
                                    value={field.description || ''}
                                    onChange={(e) => onUpdateField(field.id, { description: e.target.value })}
                                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                />
                                <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={field.required}
                                        onChange={(e) => onUpdateField(field.id, { required: e.target.checked })}
                                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                    />
                                    Req
                                </label>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onRemoveField(field.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                            title="Eliminar campo"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                ))}
            </div>
        )}
    </div>
);
