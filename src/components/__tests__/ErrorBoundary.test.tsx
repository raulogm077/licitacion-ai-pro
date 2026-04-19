import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorBoundary } from '../ErrorBoundary';

// Suppress console.error noise from error boundaries in test output
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// React also logs errors to console.error when a component throws, we need to spy on it and suppress it
// However jsdom also throws an unhandled exception for React 18 error boundaries we have to suppress

// A component that throws to trigger the error boundary
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) {
        throw new Error('Test error message');
    }
    return <div>Normal render</div>;
}

describe('ErrorBoundary', () => {
    let unhandledExceptionListener: any;
    beforeEach(() => {
        consoleError.mockClear();

        // Prevent JSDOM from outputting unhandled rejections to stderr
        unhandledExceptionListener = (e: ErrorEvent) => {
            e.preventDefault(); // Stop it from printing to console
        };
        window.addEventListener('error', unhandledExceptionListener);
    });

    afterEach(() => {
        window.removeEventListener('error', unhandledExceptionListener);
    });

    it('renders children when no error occurs', () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={false} />
            </ErrorBoundary>
        );
        expect(screen.getByText('Normal render')).toBeInTheDocument();
    });

    it('renders default fallback UI when a child throws', () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
        expect(screen.getByText(/Ha ocurrido un error inesperado/)).toBeInTheDocument();
    });

    it('shows the error message in the fallback UI', () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('renders custom fallback when provided', () => {
        render(
            <ErrorBoundary fallback={<div>Custom Fallback</div>}>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
        expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument();
    });

    it('shows Reintentar button in default fallback', () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
    });

    it('logs the error via componentDidCatch', () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(consoleError).toHaveBeenCalledWith('Uncaught error:', expect.any(Error), expect.anything());
    });

    it('navigates to / when Reintentar is clicked', () => {
        const originalHref = window.location.href;
        // jsdom allows assignment to window.location.href
        Object.defineProperty(window, 'location', {
            value: { href: '' },
            writable: true,
        });

        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));

        expect(window.location.href).toBe('/');

        // Restore
        Object.defineProperty(window, 'location', {
            value: { href: originalHref },
            writable: true,
        });
    });
});
