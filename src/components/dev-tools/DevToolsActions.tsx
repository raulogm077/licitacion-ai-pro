import { logger } from '../../services/logger';
import { useLoggerStore } from '../../services/logger';
import { AlertCircle } from 'lucide-react';

interface DevToolsActionsProps {
    addResult: (message: string) => void;
}

export function DevToolsActions({ addResult }: DevToolsActionsProps) {
    const clearLogs = useLoggerStore(s => s.clearLogs);

    const testSentryError = () => {
        try {
            throw new Error('🧪 Test Sentry Error - This is a test error from DevTools');
        } catch (error) {
            logger.error('Test error thrown', error, {
                component: 'DevToolsPanel',
                action: 'test_sentry'
            });
            addResult('✅ Error thrown - Check Sentry dashboard');
        }
    };

    const testSentryWarning = () => {
        logger.warn('Test warning from DevTools', { test: true }, {
            component: 'DevToolsPanel'
        });
        addResult('✅ Warning logged');
    };

    const testAnalyticsEvent = () => {
        logger.info('Test analytics event', { event: 'test_click' }, {
            component: 'DevToolsPanel',
            action: 'test_analytics'
        });
        addResult('✅ Event logged - Check Analytics');
    };

    const handleClearLogs = () => {
        clearLogs();
        addResult('🗑️ Logs cleared');
    };

    return (
        <div className="space-y-2 mb-3">
            <button
                onClick={testSentryError}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm flex items-center gap-2"
            >
                <AlertCircle className="h-4 w-4" />
                Test Sentry Error
            </button>

            <button
                onClick={testSentryWarning}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm"
            >
                Test Warning
            </button>

            <button
                onClick={testAnalyticsEvent}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
            >
                Test Analytics Event
            </button>

            <button
                onClick={handleClearLogs}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm"
            >
                Clear Logs
            </button>
        </div>
    );
}
