import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../Dialog';

function renderDialog(open = true, onOpenChange = vi.fn()) {
    render(
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Título del diálogo</DialogTitle>
                </DialogHeader>
                <button>Acción</button>
            </DialogContent>
        </Dialog>
    );
    return onOpenChange;
}

describe('Dialog accessibility', () => {
    it('renders nothing when closed', () => {
        renderDialog(false);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('exposes role=dialog, aria-modal and an accessible name from the title', () => {
        renderDialog();
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAccessibleName('Título del diálogo');
    });

    it('closes on Escape', () => {
        const onOpenChange = renderDialog();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('moves focus inside the dialog when it opens', () => {
        renderDialog();
        const dialog = screen.getByRole('dialog');
        expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('closes from the close button', () => {
        const onOpenChange = renderDialog();
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
