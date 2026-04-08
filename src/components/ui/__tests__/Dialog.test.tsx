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

            const wrapper = container.firstChild as HTMLElement;
            const backdrop = wrapper.firstChild as HTMLElement;

            expect(backdrop).toBeInTheDocument();
            fireEvent.click(backdrop);
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });

    describe('DialogContent', () => {
        it('renders content and close button', () => {
            const onOpenChange = vi.fn();
            render(
                <Dialog open={true} onOpenChange={onOpenChange}>
                    <DialogContent>
                        <div>Content body</div>
                    </DialogContent>
                </Dialog>
            );
            expect(screen.getByText('Content body')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
        });

        it('calls onOpenChange when close button is clicked', () => {
            const onOpenChange = vi.fn();
            render(
                <Dialog open={true} onOpenChange={onOpenChange}>
                    <DialogContent>
                        <div>Content body</div>
                    </DialogContent>
                </Dialog>
            );
            fireEvent.click(screen.getByRole('button', { name: /close/i }));
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });

    describe('DialogHeader & DialogTitle', () => {
        it('renders DialogHeader and DialogTitle correctly', () => {
            render(
                <Dialog open={true} onOpenChange={() => {}}>
                    <DialogContent>
                        <DialogHeader data-testid="header">
                            <DialogTitle data-testid="title">Title text</DialogTitle>
                        </DialogHeader>
                    </DialogContent>
                </Dialog>
            );
            expect(screen.getByTestId('header')).toBeInTheDocument();
            expect(screen.getByTestId('title')).toBeInTheDocument();
            expect(screen.getByText('Title text')).toBeInTheDocument();
            expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
        });
    });
});
