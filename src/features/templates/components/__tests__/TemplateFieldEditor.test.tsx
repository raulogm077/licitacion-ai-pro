import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TemplateFieldEditor } from '../TemplateFieldEditor';
import { TemplateField } from '../../../../types';

describe('TemplateFieldEditor', () => {
    it('renders empty state correctly', () => {
        render(
            <TemplateFieldEditor
                fields={[]}
                onAddField={vi.fn()}
                onUpdateField={vi.fn()}
                onRemoveField={vi.fn()}
            />
        );
        expect(screen.getByText('No hay campos definidos.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Añade el primer campo' })).toBeInTheDocument();
    });

    it('renders fields correctly', () => {
        const mockFields: TemplateField[] = [
            {
                id: '1',
                name: 'test_key',
                type: 'texto',
                required: true,
                description: 'Test Description',
            }
        ];
        render(
            <TemplateFieldEditor
                fields={mockFields}
                onAddField={vi.fn()}
                onUpdateField={vi.fn()}
                onRemoveField={vi.fn()}
            />
        );
        expect(screen.getByDisplayValue('test_key')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test Description')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Req' })).toBeChecked();
    });

    it('calls onAddField when Add Field button is clicked', () => {
        const onAddField = vi.fn();
        render(
            <TemplateFieldEditor
                fields={[]}
                onAddField={onAddField}
                onUpdateField={vi.fn()}
                onRemoveField={vi.fn()}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Añadir Campo' }));
        expect(onAddField).toHaveBeenCalled();
    });

    it('calls onUpdateField when inputs change', () => {
        const onUpdateField = vi.fn();
        const mockFields: TemplateField[] = [
            {
                id: '1',
                name: 'test_key',
                type: 'texto',
                required: true,
                description: 'Test Description',
            }
        ];
        render(
            <TemplateFieldEditor
                fields={mockFields}
                onAddField={vi.fn()}
                onUpdateField={onUpdateField}
                onRemoveField={vi.fn()}
            />
        );
        fireEvent.change(screen.getByDisplayValue('test_key'), { target: { value: 'new_key' } });
        expect(onUpdateField).toHaveBeenCalledWith('1', { name: 'new_key' });

        fireEvent.change(screen.getByDisplayValue('Test Description'), { target: { value: 'new description' } });
        expect(onUpdateField).toHaveBeenCalledWith('1', { description: 'new description' });

        fireEvent.click(screen.getByRole('checkbox', { name: 'Req' }));
        expect(onUpdateField).toHaveBeenCalledWith('1', { required: false });
    });

    it('calls onRemoveField when remove button is clicked', () => {
        const onRemoveField = vi.fn();
        const mockFields: TemplateField[] = [
            {
                id: '1',
                name: 'test_key',
                type: 'texto',
                required: true,
                description: 'Test Description',
            }
        ];
        render(
            <TemplateFieldEditor
                fields={mockFields}
                onAddField={vi.fn()}
                onUpdateField={vi.fn()}
                onRemoveField={onRemoveField}
            />
        );
        fireEvent.click(screen.getByTitle('Eliminar campo'));
        expect(onRemoveField).toHaveBeenCalledWith('1');
    });
});
