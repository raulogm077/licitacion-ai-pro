import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, AlertCircle } from 'lucide-react';
import { useTemplates } from '../features/templates/hooks/useTemplates';
import { TemplateForm } from '../features/templates/components/TemplateForm';
import { TemplateList } from '../features/templates/components/TemplateList';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/Dialog';

export const TemplatesPage: React.FC = () => {
    const { t } = useTranslation();
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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
                    onDelete={(id) => setConfirmDeleteId(id)}
                    onCreate={handleCreate}
                />
            )}

            <Dialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
                <DialogContent className="dark:bg-slate-800 dark:border-slate-700">
                    <DialogHeader>
                        <DialogTitle className="text-slate-900 dark:text-white">
                            {t('templates.confirm_delete_title', 'Eliminar plantilla')}
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t(
                            'templates.confirm_delete',
                            'Esta acción eliminará la plantilla de forma permanente y no se puede deshacer.'
                        )}
                    </p>
                    <div className="mt-5 flex items-center justify-end gap-3">
                        <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                        >
                            {t('common.cancel', 'Cancelar')}
                        </button>
                        <button
                            onClick={async () => {
                                if (confirmDeleteId) {
                                    await handleDelete(confirmDeleteId);
                                    setConfirmDeleteId(null);
                                }
                            }}
                            disabled={isSubmitting}
                            className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
                        >
                            {t('common.delete', 'Eliminar')}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
