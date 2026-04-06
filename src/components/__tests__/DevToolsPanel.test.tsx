import { render, screen, fireEvent } from '@testing-library/react';
import { DevToolsPanel } from '../DevToolsPanel';
import { vi } from 'vitest';
import { features } from '../../config/features';
import { logger } from '../../services/logger';

// Mock features config
vi.mock('../../config/features', () => ({
    features: {
        enableDevTools: true,
        enableSentry: true,
        enableAnalytics: true,
    },
}));

// Mock logger
vi.mock('../../services/logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
    useLoggerStore: vi.fn(() => vi.fn()), // Mock useLoggerStore to return a dummy clearLogs function
}));

describe('DevToolsPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        features.enableDevTools = true;
    });

    it('does not render when enableDevTools is false', () => {
        features.enableDevTools = false;
        const { container } = render(<DevToolsPanel />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders when enableDevTools is true', () => {
        render(<DevToolsPanel />);
        expect(screen.getByText('Dev Tools')).toBeInTheDocument();
        expect(screen.getByText('DEV ONLY')).toBeInTheDocument();
    });

    it('tests Sentry Error', async () => {
        render(<DevToolsPanel />);
        const button = screen.getByText('Test Sentry Error');
        fireEvent.click(button);

        expect(logger.error).toHaveBeenCalledWith(
            'Test error thrown',
            expect.any(Error),
            expect.objectContaining({
                component: 'DevToolsPanel',
                action: 'test_sentry',
            })
        );
        expect(await screen.findByText(/✅ Error thrown - Check Sentry dashboard/)).toBeInTheDocument();
    });

    it('tests Warning', async () => {
        render(<DevToolsPanel />);
        const button = screen.getByText('Test Warning');
        fireEvent.click(button);

        expect(logger.warn).toHaveBeenCalledWith(
            'Test warning from DevTools',
            { test: true },
            {
                component: 'DevToolsPanel',
            }
        );
        expect(await screen.findByText(/✅ Warning logged/)).toBeInTheDocument();
    });

    it('tests Analytics Event', async () => {
        render(<DevToolsPanel />);
        const button = screen.getByText('Test Analytics Event');
        fireEvent.click(button);

        expect(logger.info).toHaveBeenCalledWith(
            'Test analytics event',
            { event: 'test_click' },
            {
                component: 'DevToolsPanel',
                action: 'test_analytics',
            }
        );
        expect(await screen.findByText(/✅ Event logged - Check Analytics/)).toBeInTheDocument();
    });

    it('clears logs and results', async () => {
        render(<DevToolsPanel />);

        // Add a result first
        fireEvent.click(screen.getByText('Test Warning'));
        expect(await screen.findByText(/✅ Warning logged/)).toBeInTheDocument();

        // Clear logs
        const clearLogsBtn = screen.getByText('Clear Logs');
        fireEvent.click(clearLogsBtn);
        expect(await screen.findByText(/🗑️ Logs cleared/)).toBeInTheDocument();

        // Clear results display
        const clearBtn = screen.getByText('Clear');
        fireEvent.click(clearBtn);

        expect(screen.queryByText(/✅ Warning logged/)).not.toBeInTheDocument();
        expect(screen.queryByText(/🗑️ Logs cleared/)).not.toBeInTheDocument();
    });
});
