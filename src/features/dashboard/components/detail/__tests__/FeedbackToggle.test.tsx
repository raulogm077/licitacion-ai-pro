import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackToggle } from '../FeedbackToggle';
import { logger } from '../../../../../services/logger';

vi.mock('../../../../../services/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('../../../../../services/feedback.service', () => ({
    feedbackService: {
        saveFeedback: vi.fn().mockResolvedValue({ ok: true, value: {} }),
        removeFeedback: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    },
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

        expect(upBtn.className).toContain('text-slate-400');

        fireEvent.click(upBtn);

        expect(upBtn.className).toContain('text-green-700');
        expect(logger.info).toHaveBeenCalledWith('Feedback for test.field: Correcto. Value: Test Value');

        fireEvent.click(upBtn);
        expect(upBtn.className).toContain('text-slate-400');
    });

    it('logs negative feedback and toggles state when clicking thumb down', () => {
        render(<FeedbackToggle fieldPath="test.field" value="Test Value" />);

        const downBtn = screen.getByRole('button', { name: 'Marcar como incorrecto' });
        const upBtn = screen.getByRole('button', { name: 'Marcar como correcto' });

        fireEvent.click(downBtn);

        expect(downBtn.className).toContain('text-red-700');
        expect(logger.info).toHaveBeenCalledWith('Feedback for test.field: Incorrecto. Value: Test Value');

        fireEvent.click(upBtn);
        expect(upBtn.className).toContain('text-green-700');
        expect(downBtn.className).not.toContain('text-red-700');
        expect(logger.info).toHaveBeenCalledWith('Feedback for test.field: Correcto. Value: Test Value');
    });

    it('does not call DB when licitacionHash is not provided', async () => {
        const fbModule = await import('../../../../../services/feedback.service');
        const saveSpy = vi.mocked(fbModule.feedbackService.saveFeedback);
        saveSpy.mockClear();

        render(<FeedbackToggle fieldPath="test.field" value="Test Value" />);

        fireEvent.click(screen.getByRole('button', { name: 'Marcar como correcto' }));

        expect(saveSpy).not.toHaveBeenCalled();
    });

    it('calls saveFeedback when a thumb is clicked and licitacionHash is provided', async () => {
        const fbModule = await import('../../../../../services/feedback.service');
        const saveSpy = vi.mocked(fbModule.feedbackService.saveFeedback);
        saveSpy.mockClear();

        render(<FeedbackToggle fieldPath="test.field" value="Test Value" licitacionHash="hash123" />);

        fireEvent.click(screen.getByRole('button', { name: 'Marcar como correcto' }));

        expect(saveSpy).toHaveBeenCalledWith('hash123', 'test.field', 'Test Value', 'up');
    });

    it('calls removeFeedback when feedback is untoggled to idle state', async () => {
        const fbModule = await import('../../../../../services/feedback.service');
        const removeSpy = vi.mocked(fbModule.feedbackService.removeFeedback);
        removeSpy.mockClear();

        render(<FeedbackToggle fieldPath="test.field" value="Test Value" licitacionHash="hash123" />);

        const upBtn = screen.getByRole('button', { name: 'Marcar como correcto' });
        
        // Click to toggle "up"
        fireEvent.click(upBtn);
        // Click again to return to "idle"
        fireEvent.click(upBtn);

        expect(removeSpy).toHaveBeenCalledWith('hash123', 'test.field');
    });
});

