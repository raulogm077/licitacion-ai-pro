import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TemplateForm } from '../TemplateForm';
import { ExtractionTemplate } from '../../../../types';

describe('TemplateForm', () => {
    const mockTemplate: Partial<ExtractionTemplate> = {
        name: 'Test Template',
        description: 'Test Description',
        schema: []
    };

    it('renders form fields correctly for creating a new template', () => {
        render(
            <TemplateForm
                template={{...mockTemplate, id: undefined}}
                isSubmitting={false}
                onSave={vi.fn()}
                onCancel={vi.fn()}
                onUpdateTemplate={vi.fn()}
                onAddField={vi.fn()}
                onUpdateField={vi.fn()}
                onRemoveField={vi.fn()}
            />
        );
        expect(screen.getByText('Crear Nueva Plantilla')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test Template')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test Description')).toBeInTheDocument();
    });

    it('renders form fields correctly for editing an existing template', () => {
        render(
            <TemplateForm
                template={{...mockTemplate, id: '1'}}
                isSubmitting={false}
                onSave={vi.fn()}
                onCancel={vi.fn()}
                onUpdateTemplate={vi.fn()}
                onAddField={vi.fn()}
                onUpdateField={vi.fn()}
                onRemoveField={vi.fn()}
            />
        );
        expect(screen.getByText('Editar Plantilla')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test Template')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test Description')).toBeInTheDocument();
    });

    it('calls onUpdateTemplate when inputs change', () => {
        const onUpdateTemplate = vi.fn();
        render(
            <TemplateForm
                template={mockTemplate}
                isSubmitting={false}
                onSave={vi.fn()}
                onCancel={vi.fn()}
                onUpdateTemplate={onUpdateTemplate}
                onAddField={vi.fn()}
                onUpdateField={vi.fn()}
                onRemoveField={vi.fn()}
            />
        );
        fireEvent.change(screen.getByDisplayValue('Test Template'), { target: { value: 'New Template Name' } });
        expect(onUpdateTemplate).toHaveBeenCalledWith({ name: 'New Template Name' });

        fireEvent.change(screen.getByDisplayValue('Test Description'), { target: { value: 'New Description' } });
        expect(onUpdateTemplate).toHaveBeenCalledWith({ description: 'New Description' });
    });

    it('calls onSave when form is submitted', () => {
        const onSave = vi.fn((e) => e.preventDefault());
        render(
            <TemplateForm
                template={mockTemplate}
                isSubmitting={false}
                onSave={onSave}
                onCancel={vi.fn()}
                onUpdateTemplate={vi.fn()}
                onAddField={vi.fn()}
                onUpdateField={vi.fn()}
                onRemoveField={vi.fn()}
            />
        );
        fireEvent.submit(screen.getByRole('button', { name: 'Guardar Plantilla' }));
        expect(onSave).toHaveBeenCalled();
    });

    it('calls onCancel when cancel button is clicked', () => {
        const onCancel = vi.fn();
        render(
            <TemplateForm
                template={mockTemplate}
                isSubmitting={false}
                onSave={vi.fn()}
                onCancel={onCancel}
                onUpdateTemplate={vi.fn()}
                onAddField={vi.fn()}
                onUpdateField={vi.fn()}
                onRemoveField={vi.fn()}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(onCancel).toHaveBeenCalled();
    });

    it('disables save button and shows loader when submitting', () => {
        const { container } = render(
            <TemplateForm
                template={mockTemplate}
                isSubmitting={true}
                onSave={vi.fn()}
                onCancel={vi.fn()}
                onUpdateTemplate={vi.fn()}
                onAddField={vi.fn()}
                onUpdateField={vi.fn()}
                onRemoveField={vi.fn()}
            />
        );
        const saveBtn = screen.getByRole('button', { name: 'Guardar Plantilla' });
        expect(saveBtn).toBeDisabled();
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });
});
