import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, Edit2, Trash2, Copy, FileText, AlertCircle } from 'lucide-react';
import { templateService } from '../services/template.service';
import { ExtractionTemplate, TemplateField } from '../types';

export const TemplatesPage: React.FC = () => {
    const { t } = useTranslation();
    const [templates, setTemplates] = useState<ExtractionTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState<Partial<ExtractionTemplate> | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await templateService.getTemplates();
            if (result.ok) {
                setTemplates(result.value);
            } else {
                setError(result.error.message);
            }
        } catch (err: any) {
            setError(err.message || 'Error loading templates');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setCurrentTemplate({ name: '', description: '', schema: [] });
        setIsEditing(true);
    };

    const handleEdit = (template: ExtractionTemplate) => {
        setCurrentTemplate(template);
        setIsEditing(true);
    };

    const handleDuplicate = async (template: ExtractionTemplate) => {
        setIsSubmitting(true);
        try {
            const result = await templateService.createTemplate(
                `${template.name} (Copy)`,
                template.description || '',
                template.schema
            );
            if (result.ok) {
                loadTemplates();
            } else {
                setError(result.error.message);
            }
        } catch (err: any) {
            setError(err.message || 'Error duplicating template');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(t('templates.confirm_delete', 'Are you sure you want to delete this template?'))) return;
        setIsSubmitting(true);
        try {
            const result = await templateService.deleteTemplate(id);
            if (result.ok) {
                loadTemplates();
            } else {
                setError(result.error.message);
            }
        } catch (err: any) {
            setError(err.message || 'Error deleting template');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTemplate?.name) return;

        setIsSubmitting(true);
        try {
            if (currentTemplate.id) {
                const result = await templateService.updateTemplate(currentTemplate.id, {
                    name: currentTemplate.name,
                    description: currentTemplate.description,
                    schema: currentTemplate.schema
                });
                if (result.ok) {
                    setIsEditing(false);
                    loadTemplates();
                } else {
                    setError(result.error.message);
                }
            } else {
                const result = await templateService.createTemplate(
                    currentTemplate.name,
                    currentTemplate.description || '',
                    currentTemplate.schema || []
                );
                if (result.ok) {
                    setIsEditing(false);
                    loadTemplates();
                } else {
                    setError(result.error.message);
                }
            }
        } catch (err: any) {
            setError(err.message || 'Error saving template');
        } finally {
            setIsSubmitting(false);
        }
    };

    const addField = () => {
        if (!currentTemplate) return;
        const newField: TemplateField = {
            id: crypto.randomUUID(),
            name: '',
            type: 'texto',
            required: false,
            description: ''
        };
        setCurrentTemplate({
            ...currentTemplate,
            schema: [...(currentTemplate.schema || []), newField]
        });
    };

    const updateField = (id: string, updates: Partial<TemplateField>) => {
        if (!currentTemplate || !currentTemplate.schema) return;
        setCurrentTemplate({
            ...currentTemplate,
            schema: currentTemplate.schema.map(f => f.id === id ? { ...f, ...updates } : f)
        });
    };

    const removeField = (id: string) => {
        if (!currentTemplate || !currentTemplate.schema) return;
        setCurrentTemplate({
            ...currentTemplate,
            schema: currentTemplate.schema.filter(f => f.id !== id)
        });
    };

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Plantillas de Extracción</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Gestiona esquemas personalizados para la extracción de datos con IA.
                    </p>
                </div>
                {!isEditing && (
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Nueva Plantilla
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 className="font-semibold">Error</h4>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}

            {isEditing && currentTemplate ? (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                    <form onSubmit={handleSave} className="p-6">
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                                    {currentTemplate.id ? 'Editar Plantilla' : 'Crear Nueva Plantilla'}
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-1">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Nombre de la Plantilla *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={currentTemplate.name || ''}
                                            onChange={e => setCurrentTemplate({...currentTemplate, name: e.target.value})}
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
                                            value={currentTemplate.description || ''}
                                            onChange={e => setCurrentTemplate({...currentTemplate, description: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                                            placeholder="Breve descripción de su propósito..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-md font-semibold text-slate-900 dark:text-white">Campos a Extraer</h4>
                                    <button
                                        type="button"
                                        onClick={addField}
                                        className="text-sm flex items-center gap-1 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Añadir Campo
                                    </button>
                                </div>

                                {(!currentTemplate.schema || currentTemplate.schema.length === 0) ? (
                                    <div className="text-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                                        <FileText className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                                        <p className="text-slate-500 dark:text-slate-400">No hay campos definidos.</p>
                                        <button
                                            type="button"
                                            onClick={addField}
                                            className="mt-2 text-brand-600 font-medium hover:underline"
                                        >
                                            Añade el primer campo
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {currentTemplate.schema.map((field, index) => (
                                            <div key={field.id} className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg flex gap-4 items-start">
                                                <div className="mt-2 text-slate-400 font-mono text-sm">{index + 1}.</div>
                                                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3">
                                                    <div className="md:col-span-4">
                                                        <input
                                                            type="text"
                                                            required
                                                            placeholder="Nombre del campo"
                                                            value={field.name}
                                                            onChange={e => updateField(field.id, { name: e.target.value })}
                                                            className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-3">
                                                        <select
                                                            value={field.type}
                                                            onChange={e => updateField(field.id, { type: e.target.value as any })}
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
                                                            onChange={e => updateField(field.id, { description: e.target.value })}
                                                            className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                                        />
                                                        <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={field.required}
                                                                onChange={e => updateField(field.id, { required: e.target.checked })}
                                                                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                                            />
                                                            Req
                                                        </label>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeField(field.id)}
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
                        </div>

                        <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
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
            ) : (
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
                                Las plantillas te permiten definir exactamente qué información debe extraer la IA de los pliegos de licitación.
                            </p>
                            <button
                                onClick={handleCreate}
                                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm transition-colors flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Crear mi primera plantilla
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                            {templates.map(template => (
                                <div key={template.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between">
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
                                            {template.schema?.slice(0, 5).map(f => (
                                                <span key={f.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-mono">
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
                                            onClick={() => handleDuplicate(template)}
                                            disabled={isSubmitting}
                                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg transition-all shadow-sm"
                                            title="Duplicar"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleEdit(template)}
                                            disabled={isSubmitting}
                                            className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-800 rounded-lg transition-all shadow-sm"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(template.id)}
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
            )}
        </div>
    );
};
