import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import { vi } from 'vitest';

describe('ErrorBoundary', () => {
    beforeAll(() => {
        // Prevent console.error from cluttering the test output
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    it('renders children when no error occurs', () => {
        render(
            <ErrorBoundary>
                <div data-testid="child">Child Content</div>
            </ErrorBoundary>
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
        expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('renders fallback when error occurs', () => {
        const ThrowError = () => {
            throw new Error('Test Error');
        };

        render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
        expect(screen.getByText('Test Error')).toBeInTheDocument();
    });

    it('renders custom fallback when provided', () => {
        const ThrowError = () => {
            throw new Error('Test Error');
        };

        render(
            <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom Fallback</div>}>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
        expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
    });

    it('calls handleReset and sets window location', () => {
        const ThrowError = () => {
            throw new Error('Test Error');
        };

        const originalLocation = window.location;
        // @ts-expect-error Mocking window location
        delete window.location;
        window.location = { ...originalLocation, href: '' } as unknown as string & Location;

        render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        const retryButton = screen.getByRole('button', { name: /reintentar/i });
        fireEvent.click(retryButton);

        expect(window.location.href).toBe('/');

        // @ts-expect-error Resetting window location
        window.location = originalLocation;
    });
});
