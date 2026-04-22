import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTemplates } from '../useTemplates';
import { templateService } from '../../../../services/template.service';
import { ExtractionTemplate } from '../../../../types';

vi.mock('../../../../services/template.service', () => ({
    templateService: {
        getTemplates: vi.fn(),
        createTemplate: vi.fn(),
        updateTemplate: vi.fn(),
        deleteTemplate: vi.fn(),
    }
}));

describe('useTemplates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(templateService.getTemplates).mockResolvedValue({ ok: true, value: [] as ExtractionTemplate[] });
    });

    it('loads templates on mount', async () => {
        const mockTemplates = [{ id: '1', name: 'Test', schema: [] } as unknown as ExtractionTemplate];
        vi.mocked(templateService.getTemplates).mockResolvedValue({ ok: true, value: mockTemplates as ExtractionTemplate[] });

        const { result } = renderHook(() => useTemplates());

        expect(result.current.loading).toBe(true);

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.templates).toEqual(mockTemplates);
    });

    it('handles load templates error', async () => {
        vi.mocked(templateService.getTemplates).mockResolvedValue({ ok: false, error: new Error('Failed to load') });

        const { result } = renderHook(() => useTemplates());

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(result.current.error).toBe('Failed to load');
    });

    it('handles create correctly', async () => {
        const { result } = renderHook(() => useTemplates());

        await act(async () => {
            result.current.handleCreate();
        });

        expect(result.current.isEditing).toBe(true);
        expect(result.current.currentTemplate).toEqual({ name: '', description: '', schema: [] });
    });

    it('handles edit correctly', async () => {
        const { result } = renderHook(() => useTemplates());

        const template = { id: '1', name: 'Test', schema: [] } as unknown as ExtractionTemplate;
        await act(async () => {
            result.current.handleEdit(template);
        });

        expect(result.current.isEditing).toBe(true);
        expect(result.current.currentTemplate).toEqual(template);
    });

    it('handles duplicate correctly', async () => {
        vi.mocked(templateService.createTemplate).mockResolvedValue({ ok: true, value: {} as unknown as ExtractionTemplate });

        const { result } = renderHook(() => useTemplates());

        const template = { id: '1', name: 'Test', description: 'Desc', schema: [] } as unknown as ExtractionTemplate;
        await act(async () => {
            await result.current.handleDuplicate(template);
        });

        expect(templateService.createTemplate).toHaveBeenCalledWith('Test (Copy)', 'Desc', []);
        expect(templateService.getTemplates).toHaveBeenCalled();
    });

    it('handles duplicate error', async () => {
        vi.mocked(templateService.createTemplate).mockResolvedValue({ ok: false, error: new Error('Duplicate failed') });

        const { result } = renderHook(() => useTemplates());

        const template = { id: '1', name: 'Test', schema: [] } as unknown as ExtractionTemplate;
        await act(async () => {
            await result.current.handleDuplicate(template);
        });

        expect(result.current.error).toBe('Duplicate failed');
    });

    it('handles delete correctly', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.mocked(templateService.deleteTemplate).mockResolvedValue({ ok: true, value: undefined });

        const { result } = renderHook(() => useTemplates());

        await act(async () => {
            await result.current.handleDelete('1', 'Are you sure?');
        });

        expect(templateService.deleteTemplate).toHaveBeenCalledWith('1');
        expect(templateService.getTemplates).toHaveBeenCalled();
    });

    it('does not delete if not confirmed', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);

        const { result } = renderHook(() => useTemplates());

        await act(async () => {
            await result.current.handleDelete('1', 'Are you sure?');
        });

        expect(templateService.deleteTemplate).not.toHaveBeenCalled();
    });

    it('handles save new template', async () => {
        vi.mocked(templateService.createTemplate).mockResolvedValue({ ok: true, value: {} as unknown as ExtractionTemplate });

        const { result } = renderHook(() => useTemplates());

        await act(async () => {
            result.current.handleCreate();
        });

        await act(async () => {
            result.current.updateTemplate({ name: 'New Template', description: '', schema: [] });
        });

        await act(async () => {
            await result.current.handleSave({ preventDefault: vi.fn() } as unknown as React.FormEvent);
        });

        expect(templateService.createTemplate).toHaveBeenCalledWith('New Template', '', []);
        expect(result.current.isEditing).toBe(false);
        expect(templateService.getTemplates).toHaveBeenCalled();
    });

    it('handles save existing template', async () => {
        vi.mocked(templateService.updateTemplate).mockResolvedValue({ ok: true, value: {} as unknown as ExtractionTemplate });

        const { result } = renderHook(() => useTemplates());

        await act(async () => {
            result.current.handleEdit({ id: '1', name: 'Test', description: 'Desc', schema: [] } as unknown as ExtractionTemplate);
        });

        await act(async () => {
            await result.current.handleSave({ preventDefault: vi.fn() } as unknown as React.FormEvent);
        });

        expect(templateService.updateTemplate).toHaveBeenCalledWith('1', { name: 'Test', description: 'Desc', schema: [] });
        expect(result.current.isEditing).toBe(false);
        expect(templateService.getTemplates).toHaveBeenCalled();
    });

    it('handles cancel editing', async () => {
        const { result } = renderHook(() => useTemplates());

        await act(async () => {
            result.current.handleCreate();
        });

        await act(async () => {
            result.current.cancelEditing();
        });

        expect(result.current.isEditing).toBe(false);
    });

    it('handles save error for new template', async () => {
        vi.mocked(templateService.createTemplate).mockResolvedValue({ ok: false, error: new Error('Save error') });

        const { result } = renderHook(() => useTemplates());

        await act(async () => {
            result.current.handleCreate();
        });

        await act(async () => {
            result.current.updateTemplate({ name: 'New Template' });
        });

        await act(async () => {
            await result.current.handleSave({ preventDefault: vi.fn() } as unknown as React.FormEvent);
        });

        expect(result.current.error).toBe('Save error');
    });

    it('handles save error for existing template', async () => {
        vi.mocked(templateService.updateTemplate).mockResolvedValue({ ok: false, error: new Error('Update error') });

        const { result } = renderHook(() => useTemplates());

        await act(async () => {
            result.current.handleEdit({ id: '1', name: 'Test' } as unknown as ExtractionTemplate);
        });

        await act(async () => {
            await result.current.handleSave({ preventDefault: vi.fn() } as unknown as React.FormEvent);
        });

        expect(result.current.error).toBe('Update error');
    });

    it('does not save if no name', async () => {
        const { result } = renderHook(() => useTemplates());

        await act(async () => {
            result.current.handleCreate();
            result.current.updateTemplate({ name: '' });
        });

        await act(async () => {
            await result.current.handleSave({ preventDefault: vi.fn() } as unknown as React.FormEvent);
        });

        expect(templateService.createTemplate).not.toHaveBeenCalled();
    });

    it('does nothing if updating non-existent field', async () => {
        const { result } = renderHook(() => useTemplates());

        await act(async () => {
            result.current.updateField('1', { name: 'test' });
            result.current.removeField('1');
        });

        expect(result.current.currentTemplate).toBe(null);
    });

    it('handles delete error', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.mocked(templateService.deleteTemplate).mockResolvedValue({ ok: false, error: new Error('Delete error') });

        const { result } = renderHook(() => useTemplates());

        await act(async () => {
            await result.current.handleDelete('1', 'Are you sure?');
        });

        expect(result.current.error).toBe('Delete error');
    });

    it('handles field operations', async () => {
        const { result } = renderHook(() => useTemplates());

        await act(async () => {
            result.current.handleCreate();
        });

        await act(async () => {
            result.current.addField();
        });

        expect(result.current.currentTemplate?.schema?.length).toBe(1);
        const fieldId = result.current.currentTemplate?.schema?.[0].id || '';

        await act(async () => {
            result.current.updateField(fieldId, { name: 'field_name' });
        });

        expect(result.current.currentTemplate?.schema?.[0].name).toBe('field_name');

        await act(async () => {
            result.current.removeField(fieldId);
        });

        expect(result.current.currentTemplate?.schema?.length).toBe(0);
    });
});
