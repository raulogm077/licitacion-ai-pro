import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, AlertCircle } from 'lucide-react';
import { useTemplates } from '../features/templates/hooks/useTemplates';
import { TemplateForm } from '../features/templates/components/TemplateForm';
import { TemplateList } from '../features/templates/components/TemplateList';

export const TemplatesPage: React.FC = () => {
    const { t } = useTranslation();
    const {
        templates,
        loading,
        error,
        isEditing,
        isSubmitting,
        currentTemplate,
        handleCreate,
        handleEdit,
        handleDuplicate,
        handleDelete,
        handleSave,
        cancelEditing,
        addField,
        updateField,
        removeField,
        updateTemplate,
    } = useTemplates();

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
                <TemplateForm
                    template={currentTemplate}
                    isSubmitting={isSubmitting}
                    onSave={handleSave}
                    onCancel={cancelEditing}
                    onUpdateTemplate={updateTemplate}
                    onAddField={addField}
                    onUpdateField={updateField}
                    onRemoveField={removeField}
                />
            ) : (
                <TemplateList
                    templates={templates}
                    loading={loading}
                    isSubmitting={isSubmitting}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onDelete={(id) =>
                        handleDelete(
                            id,
                            t('templates.confirm_delete', 'Are you sure you want to delete this template?')
                        )
                    }
                    onCreate={handleCreate}
                />
            )}
        </div>
    );
};
