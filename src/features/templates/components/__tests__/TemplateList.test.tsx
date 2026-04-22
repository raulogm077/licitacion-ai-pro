import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TemplateList } from '../TemplateList';
import { ExtractionTemplate } from '../../../../types';

describe('TemplateList', () => {
    const mockTemplates: ExtractionTemplate[] = [
        {
            id: '1',
            name: 'Template 1',
            description: 'Desc 1',
            schema: [
                { id: 'f1', name: 'field1', type: 'texto', required: true, description: '' },
                { id: 'f2', name: 'field2', type: 'texto', required: false, description: '' },
                { id: 'f3', name: 'field3', type: 'texto', required: false, description: '' },
                { id: 'f4', name: 'field4', type: 'texto', required: false, description: '' },
                { id: 'f5', name: 'field5', type: 'texto', required: false, description: '' },
                { id: 'f6', name: 'field6', type: 'texto', required: false, description: '' },
            ],
            created_at: '',
            updated_at: '', user_id: 'user1'
        },
        {
            id: '2',
            name: 'Template 2',
            description: '',
            schema: [],
            created_at: '',
            updated_at: '', user_id: 'user1'
        }
    ];

    it('renders loading state correctly', () => {
        const { container } = render(
            <TemplateList
                templates={[]}
                loading={true}
                isSubmitting={false}
                onEdit={vi.fn()}
                onDuplicate={vi.fn()}
                onDelete={vi.fn()}
                onCreate={vi.fn()}
            />
        );
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('renders empty state correctly', () => {
        render(
            <TemplateList
                templates={[]}
                loading={false}
                isSubmitting={false}
                onEdit={vi.fn()}
                onDuplicate={vi.fn()}
                onDelete={vi.fn()}
                onCreate={vi.fn()}
            />
        );
        expect(screen.getByText('Aún no hay plantillas')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Crear mi primera plantilla' })).toBeInTheDocument();
    });

    it('calls onCreate when create button is clicked in empty state', () => {
        const onCreate = vi.fn();
        render(
            <TemplateList
                templates={[]}
                loading={false}
                isSubmitting={false}
                onEdit={vi.fn()}
                onDuplicate={vi.fn()}
                onDelete={vi.fn()}
                onCreate={onCreate}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Crear mi primera plantilla' }));
        expect(onCreate).toHaveBeenCalled();
    });

    it('renders templates correctly', () => {
        render(
            <TemplateList
                templates={mockTemplates}
                loading={false}
                isSubmitting={false}
                onEdit={vi.fn()}
                onDuplicate={vi.fn()}
                onDelete={vi.fn()}
                onCreate={vi.fn()}
            />
        );
        expect(screen.getByText('Template 1')).toBeInTheDocument();
        expect(screen.getByText('Desc 1')).toBeInTheDocument();
        expect(screen.getByText('6 campos')).toBeInTheDocument();
        expect(screen.getByText('field1')).toBeInTheDocument();
        expect(screen.getByText('+1 más')).toBeInTheDocument();

        expect(screen.getByText('Template 2')).toBeInTheDocument();
        expect(screen.getByText('0 campos')).toBeInTheDocument();
    });

    it('calls action handlers when buttons are clicked', () => {
        const onEdit = vi.fn();
        const onDuplicate = vi.fn();
        const onDelete = vi.fn();

        render(
            <TemplateList
                templates={mockTemplates}
                loading={false}
                isSubmitting={false}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onCreate={vi.fn()}
            />
        );

        const editBtns = screen.getAllByTitle('Editar');
        fireEvent.click(editBtns[0]);
        expect(onEdit).toHaveBeenCalledWith(mockTemplates[0]);

        const dupBtns = screen.getAllByTitle('Duplicar');
        fireEvent.click(dupBtns[0]);
        expect(onDuplicate).toHaveBeenCalledWith(mockTemplates[0]);

        const delBtns = screen.getAllByTitle('Eliminar');
        fireEvent.click(delBtns[0]);
        expect(onDelete).toHaveBeenCalledWith('1');
    });

    it('disables action buttons when isSubmitting is true', () => {
        render(
            <TemplateList
                templates={mockTemplates}
                loading={false}
                isSubmitting={true}
                onEdit={vi.fn()}
                onDuplicate={vi.fn()}
                onDelete={vi.fn()}
                onCreate={vi.fn()}
            />
        );

        const editBtns = screen.getAllByTitle('Editar');
        expect(editBtns[0]).toBeDisabled();

        const dupBtns = screen.getAllByTitle('Duplicar');
        expect(dupBtns[0]).toBeDisabled();

        const delBtns = screen.getAllByTitle('Eliminar');
        expect(delBtns[0]).toBeDisabled();
    });
});
