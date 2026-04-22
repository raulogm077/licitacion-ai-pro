import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplatesPage } from '../TemplatesPage';
import { useTemplates } from '../../features/templates/hooks/useTemplates';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../../features/templates/hooks/useTemplates', () => ({
    useTemplates: vi.fn(),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

describe('TemplatesPage', () => {
    const mockHandleCreate = vi.fn();
    const mockHandleEdit = vi.fn();
    const mockHandleDuplicate = vi.fn();
    const mockHandleDelete = vi.fn();
    const mockHandleSave = vi.fn();
    const mockCancelEditing = vi.fn();
    const mockAddField = vi.fn();
    const mockUpdateField = vi.fn();
    const mockRemoveField = vi.fn();
    const mockUpdateTemplate = vi.fn();

    const baseMockUseTemplatesResult = {
        templates: [],
        loading: false,
        error: null,
        isEditing: false,
        isSubmitting: false,
        currentTemplate: null,
        handleCreate: mockHandleCreate,
        handleEdit: mockHandleEdit,
        handleDuplicate: mockHandleDuplicate,
        handleDelete: mockHandleDelete,
        handleSave: mockHandleSave,
        cancelEditing: mockCancelEditing,
        addField: mockAddField,
        updateField: mockUpdateField,
        removeField: mockRemoveField,
        updateTemplate: mockUpdateTemplate,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders list view by default', () => {
        vi.mocked(useTemplates).mockReturnValue(baseMockUseTemplatesResult);
        render(
            <BrowserRouter>
                <TemplatesPage />
            </BrowserRouter>
        );
        expect(screen.getByText('Plantillas de Extracción')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Nueva Plantilla' })).toBeInTheDocument();
    });

    it('calls handleCreate when Nueva Plantilla button is clicked', () => {
        vi.mocked(useTemplates).mockReturnValue(baseMockUseTemplatesResult);
        render(
            <BrowserRouter>
                <TemplatesPage />
            </BrowserRouter>
        );
        fireEvent.click(screen.getByRole('button', { name: 'Nueva Plantilla' }));
        expect(mockHandleCreate).toHaveBeenCalled();
    });

    it('renders error message if error exists', () => {
        vi.mocked(useTemplates).mockReturnValue({
            ...baseMockUseTemplatesResult,
            error: 'Test error message'
        });
        render(
            <BrowserRouter>
                <TemplatesPage />
            </BrowserRouter>
        );
        expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('renders form view when isEditing is true', () => {
        vi.mocked(useTemplates).mockReturnValue({
            ...baseMockUseTemplatesResult,
            isEditing: true,
            currentTemplate: { id: '1', name: 'Test Template' }
        });
        render(
            <BrowserRouter>
                <TemplatesPage />
            </BrowserRouter>
        );
        expect(screen.getByText('Editar Plantilla')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Nueva Plantilla' })).not.toBeInTheDocument();
    });

    it('passes handleDelete with translated confirm message to TemplateList', () => {
        vi.mocked(useTemplates).mockReturnValue({
            ...baseMockUseTemplatesResult,
            templates: [{ id: '1', name: 'Test Template', schema: [] }]
        });
        render(
            <BrowserRouter>
                <TemplatesPage />
            </BrowserRouter>
        );

        const delBtns = screen.getAllByTitle('Eliminar');
        fireEvent.click(delBtns[0]);

        expect(mockHandleDelete).toHaveBeenCalledWith('1', 'Are you sure you want to delete this template?');
    });
});
