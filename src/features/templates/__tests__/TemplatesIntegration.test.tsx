import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplatesPage } from '../../../pages/TemplatesPage';
import { BrowserRouter } from 'react-router-dom';
import { useTemplates } from '../hooks/useTemplates';
import { ExtractionTemplate } from '../../../types';

vi.mock('../hooks/useTemplates', () => ({
    useTemplates: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('Templates Integration', () => {
    const mockTemplates: ExtractionTemplate[] = [
        {
            id: '1',
            name: 'Template 1',
            description: 'Desc 1',
            schema: [
                { id: 'f1', name: 'field1', type: 'texto', required: true, description: '' }
            ],
            created_at: '',
            updated_at: '', user_id: 'user1'
        }
    ];

    const mockHandleCreate = vi.fn();
    const mockHandleEdit = vi.fn();
    const mockHandleDuplicate = vi.fn();
    const mockHandleDelete = vi.fn();
    const mockHandleSave = vi.fn((e) => e.preventDefault());
    const mockCancelEditing = vi.fn();
    const mockAddField = vi.fn();
    const mockUpdateField = vi.fn();
    const mockRemoveField = vi.fn();
    const mockUpdateTemplate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useTemplates as any).mockReturnValue({
            templates: mockTemplates,
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
        });
    });

    it('renders list of templates correctly', () => {
        render(
            <BrowserRouter>
                <TemplatesPage />
            </BrowserRouter>
        );
        expect(screen.getByText('Plantillas de Extracción')).toBeInTheDocument();
        expect(screen.getByText('Template 1')).toBeInTheDocument();
    });

    it('calls handleCreate when Nueva Plantilla button is clicked', () => {
        render(
            <BrowserRouter>
                <TemplatesPage />
            </BrowserRouter>
        );
        fireEvent.click(screen.getByRole('button', { name: 'Nueva Plantilla' }));
        expect(mockHandleCreate).toHaveBeenCalled();
    });

    it('calls handleEdit when edit button is clicked', () => {
        render(
            <BrowserRouter>
                <TemplatesPage />
            </BrowserRouter>
        );
        const editBtns = screen.getAllByTitle('Editar');
        fireEvent.click(editBtns[0]);
        expect(mockHandleEdit).toHaveBeenCalledWith(mockTemplates[0]);
    });

    it('renders error message when error exists', () => {
        (useTemplates as any).mockReturnValue({
            ...useTemplates(),
            error: 'Failed to load templates'
        });
        render(
            <BrowserRouter>
                <TemplatesPage />
            </BrowserRouter>
        );
        expect(screen.getByText('Failed to load templates')).toBeInTheDocument();
    });

    it('renders form when isEditing is true', () => {
        (useTemplates as any).mockReturnValue({
            ...useTemplates(),
            isEditing: true,
            currentTemplate: mockTemplates[0]
        });
        render(
            <BrowserRouter>
                <TemplatesPage />
            </BrowserRouter>
        );
        expect(screen.getByText('Editar Plantilla')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Template 1')).toBeInTheDocument();
    });

    it('calls handleDelete when delete button is clicked', () => {
        render(
            <BrowserRouter>
                <TemplatesPage />
            </BrowserRouter>
        );
        const delBtns = screen.getAllByTitle('Eliminar');
        fireEvent.click(delBtns[0]);
        expect(mockHandleDelete).toHaveBeenCalled();
    });

    it('calls handleDuplicate when duplicate button is clicked', () => {
        render(
            <BrowserRouter>
                <TemplatesPage />
            </BrowserRouter>
        );
        const dupBtns = screen.getAllByTitle('Duplicar');
        fireEvent.click(dupBtns[0]);
        expect(mockHandleDuplicate).toHaveBeenCalledWith(mockTemplates[0]);
    });
});
