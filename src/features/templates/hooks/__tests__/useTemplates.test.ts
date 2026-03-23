import { renderHook, act, waitFor } from '@testing-library/react';
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
    },
}));

const mockTpl = (overrides: Partial<ExtractionTemplate> = {}): ExtractionTemplate => ({
    id: '1',
    name: 'Test',
    description: '',
    schema: [],
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    user_id: 'u1',
    ...overrides,
});

describe('useTemplates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(templateService.getTemplates).mockResolvedValue({ ok: true, value: [] });
    });

    it('loads templates on mount', async () => {
        const templates = [mockTpl()];
        vi.mocked(templateService.getTemplates).mockResolvedValue({ ok: true, value: templates });

        const { result } = renderHook(() => useTemplates());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.templates).toEqual(templates);
    });

    it('handles load error', async () => {
        vi.mocked(templateService.getTemplates).mockResolvedValue({
            ok: false,
            error: { message: 'Network error' } as unknown as Error,
        } as unknown as Awaited<ReturnType<typeof templateService.getTemplates>>);

        const { result } = renderHook(() => useTemplates());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe('Network error');
    });

    it('creates a new template', async () => {
        const { result } = renderHook(() => useTemplates());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.handleCreate());
        expect(result.current.isEditing).toBe(true);
        expect(result.current.currentTemplate).toEqual({ name: '', description: '', schema: [] });
    });

    it('edits an existing template', async () => {
        const tpl = mockTpl({ name: 'Existing', description: 'Desc' });
        const { result } = renderHook(() => useTemplates());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.handleEdit(tpl));
        expect(result.current.isEditing).toBe(true);
        expect(result.current.currentTemplate).toEqual(tpl);
    });

    it('cancels editing', async () => {
        const { result } = renderHook(() => useTemplates());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.handleCreate());
        act(() => result.current.cancelEditing());
        expect(result.current.isEditing).toBe(false);
    });

    it('adds a field', async () => {
        const { result } = renderHook(() => useTemplates());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.handleCreate());
        act(() => result.current.addField());
        expect(result.current.currentTemplate?.schema).toHaveLength(1);
        expect(result.current.currentTemplate?.schema?.[0].type).toBe('texto');
    });

    it('updates a field', async () => {
        const { result } = renderHook(() => useTemplates());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.handleCreate());
        act(() => result.current.addField());
        const fieldId = result.current.currentTemplate?.schema?.[0].id || '';
        act(() => result.current.updateField(fieldId, { name: 'NewName' }));
        expect(result.current.currentTemplate?.schema?.[0].name).toBe('NewName');
    });

    it('removes a field', async () => {
        const { result } = renderHook(() => useTemplates());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.handleCreate());
        act(() => result.current.addField());
        const fieldId = result.current.currentTemplate?.schema?.[0].id || '';
        act(() => result.current.removeField(fieldId));
        expect(result.current.currentTemplate?.schema).toHaveLength(0);
    });

    it('duplicates a template', async () => {
        vi.mocked(templateService.createTemplate).mockResolvedValue({
            ok: true,
            value: mockTpl({ id: '2', name: 'Copy' }),
        });

        const { result } = renderHook(() => useTemplates());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.handleDuplicate(mockTpl({ name: 'Original', description: 'Desc' }));
        });

        expect(templateService.createTemplate).toHaveBeenCalledWith('Original (Copy)', 'Desc', []);
    });

    it('saves a new template', async () => {
        vi.mocked(templateService.createTemplate).mockResolvedValue({
            ok: true,
            value: mockTpl({ name: 'New' }),
        });

        const { result } = renderHook(() => useTemplates());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.handleCreate());
        act(() => result.current.updateTemplate({ name: 'New Template' }));

        const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
        await act(async () => {
            await result.current.handleSave(mockEvent);
        });

        expect(templateService.createTemplate).toHaveBeenCalledWith('New Template', '', []);
        expect(result.current.isEditing).toBe(false);
    });

    it('saves an existing template (update)', async () => {
        vi.mocked(templateService.updateTemplate).mockResolvedValue({
            ok: true,
            value: mockTpl({ name: 'Updated' }),
        });

        const { result } = renderHook(() => useTemplates());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.handleEdit(mockTpl({ name: 'Existing', description: 'Old' })));
        act(() => result.current.updateTemplate({ name: 'Updated' }));

        const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
        await act(async () => {
            await result.current.handleSave(mockEvent);
        });

        expect(templateService.updateTemplate).toHaveBeenCalledWith('1', expect.objectContaining({ name: 'Updated' }));
    });
});
