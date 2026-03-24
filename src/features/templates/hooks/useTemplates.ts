import { useState, useEffect, useCallback } from 'react';
import { templateService } from '../../../services/template.service';
import { ExtractionTemplate, TemplateField } from '../../../types';

export function useTemplates() {
    const [templates, setTemplates] = useState<ExtractionTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState<Partial<ExtractionTemplate> | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await templateService.getTemplates();
            if (result.ok) {
                setTemplates(result.value);
            } else {
                setError(result.error.message);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error loading templates');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    const handleCreate = useCallback(() => {
        setCurrentTemplate({ name: '', description: '', schema: [] });
        setIsEditing(true);
    }, []);

    const handleEdit = useCallback((template: ExtractionTemplate) => {
        setCurrentTemplate(template);
        setIsEditing(true);
    }, []);

    const handleDuplicate = useCallback(
        async (template: ExtractionTemplate) => {
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
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Error duplicating template');
            } finally {
                setIsSubmitting(false);
            }
        },
        [loadTemplates]
    );

    const handleDelete = useCallback(
        async (id: string, confirmMessage: string) => {
            if (!window.confirm(confirmMessage)) return;
            setIsSubmitting(true);
            try {
                const result = await templateService.deleteTemplate(id);
                if (result.ok) {
                    loadTemplates();
                } else {
                    setError(result.error.message);
                }
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Error deleting template');
            } finally {
                setIsSubmitting(false);
            }
        },
        [loadTemplates]
    );

    const handleSave = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!currentTemplate?.name) return;

            setIsSubmitting(true);
            try {
                if (currentTemplate.id) {
                    const result = await templateService.updateTemplate(currentTemplate.id, {
                        name: currentTemplate.name,
                        description: currentTemplate.description,
                        schema: currentTemplate.schema,
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
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Error saving template');
            } finally {
                setIsSubmitting(false);
            }
        },
        [currentTemplate, loadTemplates]
    );

    const cancelEditing = useCallback(() => {
        setIsEditing(false);
    }, []);

    const addField = useCallback(() => {
        if (!currentTemplate) return;
        const newField: TemplateField = {
            id: crypto.randomUUID(),
            name: '',
            type: 'texto',
            required: false,
            description: '',
        };
        setCurrentTemplate({
            ...currentTemplate,
            schema: [...(currentTemplate.schema || []), newField],
        });
    }, [currentTemplate]);

    const updateField = useCallback(
        (id: string, updates: Partial<TemplateField>) => {
            if (!currentTemplate?.schema) return;
            setCurrentTemplate({
                ...currentTemplate,
                schema: currentTemplate.schema.map((f) => (f.id === id ? { ...f, ...updates } : f)),
            });
        },
        [currentTemplate]
    );

    const removeField = useCallback(
        (id: string) => {
            if (!currentTemplate?.schema) return;
            setCurrentTemplate({
                ...currentTemplate,
                schema: currentTemplate.schema.filter((f) => f.id !== id),
            });
        },
        [currentTemplate]
    );

    const updateTemplate = useCallback(
        (updates: Partial<ExtractionTemplate>) => {
            if (!currentTemplate) return;
            setCurrentTemplate({ ...currentTemplate, ...updates });
        },
        [currentTemplate]
    );

    return {
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
    };
}
