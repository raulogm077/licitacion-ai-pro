import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackToggle } from '../FeedbackToggle';
import { logger } from '../../../../../services/logger';

// Mock logger
vi.mock('../../../../../services/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    }
}));

describe('FeedbackToggle Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders both thumbs up and thumbs down buttons', () => {
        render(<FeedbackToggle fieldPath="test.field" value="Test Value" />);

        expect(screen.getByRole('button', { name: 'Marcar como correcto' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Marcar como incorrecto' })).toBeInTheDocument();
    });

    it('logs positive feedback and toggles state when clicking thumb up', () => {
        render(<FeedbackToggle fieldPath="test.field" value="Test Value" />);

        const upBtn = screen.getByRole('button', { name: 'Marcar como correcto' });

        // Initial state
        expect(upBtn.className).toContain('text-slate-400');

        // Click UP
        fireEvent.click(upBtn);

        // Active state
        expect(upBtn.className).toContain('text-green-700');
        expect(logger.info).toHaveBeenCalledWith('Feedback for test.field: Correcto. Value: Test Value');

        // Click UP again to untoggle
        fireEvent.click(upBtn);

        // Back to idle
        expect(upBtn.className).toContain('text-slate-400');
    });

    it('logs negative feedback and toggles state when clicking thumb down', () => {
        render(<FeedbackToggle fieldPath="test.field" value="Test Value" />);

        const downBtn = screen.getByRole('button', { name: 'Marcar como incorrecto' });
        const upBtn = screen.getByRole('button', { name: 'Marcar como correcto' });

        // Click DOWN
        fireEvent.click(downBtn);

        // Active state
        expect(downBtn.className).toContain('text-red-700');
        expect(logger.info).toHaveBeenCalledWith('Feedback for test.field: Incorrecto. Value: Test Value');

        // Click UP (should switch from DOWN to UP)
        fireEvent.click(upBtn);
        expect(upBtn.className).toContain('text-green-700');
        expect(downBtn.className).not.toContain('text-red-700');
        expect(logger.info).toHaveBeenCalledWith('Feedback for test.field: Correcto. Value: Test Value');
    });
});
