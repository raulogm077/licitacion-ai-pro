import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EvidenceToggle } from '../EvidenceToggle';

describe('EvidenceToggle', () => {
    it('does not render if no evidence is provided', () => {
        const { container } = render(<EvidenceToggle evidence={undefined} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders toggle button and opens/closes popover', () => {
        const evidence = { quote: 'Test quote', pageHint: '12' };
        render(<EvidenceToggle evidence={evidence} />);

        const btn = screen.getByTitle('Ver evidencia en el documento');
        expect(btn).toBeInTheDocument();

        // Popover initially hidden
        expect(screen.queryByText('"Test quote"')).not.toBeInTheDocument();

        // Click to open
        fireEvent.click(btn);
        expect(screen.getByText('"Test quote"')).toBeInTheDocument();
        expect(screen.getByText('Pág. 12')).toBeInTheDocument();

        // Click backdrop to close
        // We find the backdrop by the aria-hidden attribute or simulating a click on the backdrop div
        // The backdrop is the previous sibling of the popover content or we can query by clicking the div itself
        // Let's just click the button again to toggle
        fireEvent.click(btn);
        expect(screen.queryByText('"Test quote"')).not.toBeInTheDocument();
    });
});
