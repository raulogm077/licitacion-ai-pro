import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagManager } from '../TagManager';

// Only mock icons
vi.mock('lucide-react', () => ({
    X: () => <span data-testid="icon-x">X</span>,
    Tag: () => <span data-testid="icon-tag">Tag</span>,
    Plus: () => <span data-testid="icon-plus">+</span>,
}));

describe('TagManager', () => {
    const mockOnChange = vi.fn();

    it('renders initial tags', () => {
        render(<TagManager tags={['tag1', 'tag2']} onChange={mockOnChange} />);
        expect(screen.getByText('tag1')).toBeInTheDocument();
        expect(screen.getByText('tag2')).toBeInTheDocument();
    });

    beforeEach(() => {
        mockOnChange.mockClear();
    });

    it('adds a new tag via input', () => {
        render(<TagManager tags={[]} onChange={mockOnChange} />);
        const input = screen.getByPlaceholderText(/añadir/i);
        fireEvent.change(input, { target: { value: 'new' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(mockOnChange).toHaveBeenCalledWith(['new']);
    });

    it('removes a tag when clicked', () => {
        render(<TagManager tags={['removable']} onChange={mockOnChange} />);
        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[0]);
        expect(mockOnChange).toHaveBeenCalledWith([]);
    });

    it('filters suggestions based on input', () => {
        render(<TagManager tags={['existing']} onChange={mockOnChange} suggestions={['apple', 'banana']} />);
        const input = screen.getByPlaceholderText(/añadir/i);

        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'ap' } });

        expect(screen.getByText('apple')).toBeInTheDocument();
        expect(screen.queryByText('banana')).not.toBeInTheDocument();
    });

    it('adds a new tag via suggestions click', () => {
        render(<TagManager tags={[]} onChange={mockOnChange} suggestions={['python']} />);
        const input = screen.getByPlaceholderText(/añadir/i);

        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'py' } });

        const suggestion = screen.getByText('python');
        fireEvent.click(suggestion);

        expect(mockOnChange).toHaveBeenCalledWith(['python']);
    });
});
