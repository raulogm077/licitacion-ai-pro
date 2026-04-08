import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../Dialog';

describe('Dialog Components', () => {
    describe('Dialog', () => {
        it('does not render when open is false', () => {
            const { container } = render(
                <Dialog open={false} onOpenChange={() => {}}>
                    <div data-testid="child" />
                </Dialog>
            );
            expect(container).toBeEmptyDOMElement();
        });

        it('renders children when open is true', () => {
            render(
                <Dialog open={true} onOpenChange={() => {}}>
                    <div data-testid="child">Test Child</div>
                </Dialog>
            );
            expect(screen.getByTestId('child')).toBeInTheDocument();
        });

        it('calls onOpenChange when backdrop is clicked', () => {
            const onOpenChange = vi.fn();
            const { container } = render(
                <Dialog open={true} onOpenChange={onOpenChange}>
                    <div>Content</div>
                </Dialog>
            );
            // The backdrop is the first div with bg-black/50
            const backdrop = container.querySelector('.bg-black\\/50');
            expect(backdrop).toBeInTheDocument();
            fireEvent.click(backdrop!);
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });

    describe('DialogContent', () => {
        it('renders content and close button', () => {
            const onOpenChange = vi.fn();
            render(
                <DialogContent onOpenChange={onOpenChange}>
                    <div>Content body</div>
                </DialogContent>
            );
            expect(screen.getByText('Content body')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
        });

        it('calls onOpenChange when close button is clicked', () => {
            const onOpenChange = vi.fn();
            render(
                <DialogContent onOpenChange={onOpenChange}>
                    <div>Content body</div>
                </DialogContent>
            );
            fireEvent.click(screen.getByRole('button', { name: /close/i }));
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });

    describe('DialogHeader', () => {
        it('renders DialogHeader', () => {
            render(<DialogHeader data-testid="header">Header text</DialogHeader>);
            expect(screen.getByTestId('header')).toBeInTheDocument();
            expect(screen.getByText('Header text')).toBeInTheDocument();
        });
    });

    describe('DialogTitle', () => {
        it('renders DialogTitle', () => {
            render(<DialogTitle data-testid="title">Title text</DialogTitle>);
            expect(screen.getByTestId('title')).toBeInTheDocument();
            expect(screen.getByText('Title text')).toBeInTheDocument();
            expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
        });
    });
});
