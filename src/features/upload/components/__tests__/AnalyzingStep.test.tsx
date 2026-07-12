import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnalyzingStep } from '../AnalyzingStep';
import { StepIndicator } from '../StepIndicator';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, fallback?: string) => fallback || key }),
    Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}));

describe('StepIndicator', () => {
    it('marks the active step and checks completed ones', () => {
        render(<StepIndicator currentStep="analyzing" />);
        const active = screen.getByText('2').closest('[aria-current="step"]');
        expect(active).not.toBeNull();
        // Step 1 is completed → its number is replaced by a check icon
        expect(screen.queryByText('1')).not.toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders all three steps on upload', () => {
        render(<StepIndicator currentStep="upload" />);
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
    });
});

describe('AnalyzingStep', () => {
    const baseProps = {
        thinkingOutput: 'Iniciando pipeline\nFase: ingestion',
        progress: 42,
        currentPhase: 'extraction' as const,
        onCancel: vi.fn(),
    };

    it('renders the five pipeline phases as a checklist', () => {
        render(<AnalyzingStep {...baseProps} />);
        expect(screen.getByText('Ingesta del documento')).toBeInTheDocument();
        expect(screen.getByText('Mapa del documento')).toBeInTheDocument();
        expect(screen.getByText('Extracción de bloques')).toBeInTheDocument();
        expect(screen.getByText('Consolidación')).toBeInTheDocument();
        expect(screen.getByText('Validación')).toBeInTheDocument();
    });

    it('exposes a real progressbar with the current value', () => {
        render(<AnalyzingStep {...baseProps} />);
        const bar = screen.getByRole('progressbar');
        expect(bar).toHaveAttribute('aria-valuenow', '42');
        expect(screen.getByText('42%')).toBeInTheDocument();
    });

    it('renders terminal output lines', () => {
        render(<AnalyzingStep {...baseProps} />);
        expect(screen.getByText('Iniciando pipeline')).toBeInTheDocument();
        expect(screen.getByText('Fase: ingestion')).toBeInTheDocument();
    });

    it('calls onCancel from the cancel button', () => {
        const onCancel = vi.fn();
        render(<AnalyzingStep {...baseProps} onCancel={onCancel} />);
        fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
        expect(onCancel).toHaveBeenCalled();
    });
});
