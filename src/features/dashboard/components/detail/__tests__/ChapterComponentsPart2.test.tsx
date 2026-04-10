import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TechnicalJsonModal } from '../ChapterComponentsPart2';
import { PliegoVM } from '../../../model/pliego-vm';

describe('TechnicalJsonModal', () => {
    it('renders the modal when isOpen is true and copies text', async () => {
        const vm = {
            result: { test: 'value' },
        } as unknown as PliegoVM;

        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn(),
            },
        });

        render(<TechnicalJsonModal vm={vm} isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByText('Datos Técnicos (JSON)')).toBeInTheDocument();

        const copyBtn = screen.getByText('Copiar JSON');
        fireEvent.click(copyBtn);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(JSON.stringify(vm.result, null, 2));
    });

    it('does not render the modal content when isOpen is false', () => {
        const vm = { result: {} } as unknown as PliegoVM;
        const { queryByText } = render(<TechnicalJsonModal vm={vm} isOpen={false} onClose={vi.fn()} />);
        expect(queryByText('Datos Técnicos (JSON)')).not.toBeInTheDocument();
    });
});
