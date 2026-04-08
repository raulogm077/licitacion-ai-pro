import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from '../ErrorBoundary';

const ProblemChild = () => {
    throw new Error('Test Error');
};

describe('ErrorBoundary Component', () => {
    it('renders children if no error occurs', () => {
        render(
            <ErrorBoundary>
                <div data-testid="child">Safe Child</div>
            </ErrorBoundary>
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renders fallback UI when error occurs', () => {
        // Prevent console.error from polluting test output
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <ErrorBoundary>
                <ProblemChild />
            </ErrorBoundary>
        );

        expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
        expect(screen.getByText(/Ha ocurrido un error inesperado al renderizar esta sección/)).toBeInTheDocument();
        expect(screen.getByText('Test Error')).toBeInTheDocument();

        spy.mockRestore();
    });

    it('renders custom fallback if provided', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom Error</div>}>
                <ProblemChild />
            </ErrorBoundary>
        );

        expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();

        spy.mockRestore();
    });

    it('resets error state when retry button is clicked', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
            ...window.location,
            href: '',
        } as any);

        render(
            <ErrorBoundary>
                <ProblemChild />
            </ErrorBoundary>
        );

        const button = screen.getByRole('button', { name: /Reintentar/i });
        fireEvent.click(button);

        expect(window.location.href).toBe('/');

        spy.mockRestore();
        locationSpy.mockRestore();
    });
});
