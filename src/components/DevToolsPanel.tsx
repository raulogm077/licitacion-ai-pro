import { useState } from 'react';
import { features } from '../config/features';
import { logger } from '../services/logger';
import { useLoggerStore } from '../services/logger';
import { AlertCircle, CheckCircle, Zap } from 'lucide-react';

/**
 * Dev Tools Panel for testing monitoring integrations
 * Only visible in development mode
 */
export function DevToolsPanel() {
    const [testResults, setTestResults] = useState<string[]>([]);
    const clearLogs = useLoggerStore(s => s.clearLogs);

    if (!features.enableDevTools) {
        return null;
    }

    const addResult = (message: string) => {
        setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

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

    const clearResults = () => {
        setTestResults([]);
    };

    return (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-2xl border border-gray-700 max-w-md z-50">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    Dev Tools
                </h3>
                <span className="text-xs bg-yellow-500 text-black px-2 py-1 rounded">
                    DEV ONLY
                </span>
            </div>

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

            {testResults.length > 0 && (
                <div className="border-t border-gray-700 pt-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">Test Results</span>
                        <button
                            onClick={clearResults}
                            className="text-xs text-gray-400 hover:text-white"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="bg-black/50 rounded p-2 max-h-32 overflow-y-auto">
                        {testResults.map((result, i) => (
                            <div key={i} className="text-xs font-mono text-green-400 mb-1">
                                {result}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="text-xs space-y-1">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-400" />
                        <span className="text-gray-400">
                            Environment: <span className="text-white">{import.meta.env.MODE}</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-400" />
                        <span className="text-gray-400">
                            Sentry: <span className="text-white">
                                {features.enableSentry ? 'Enabled' : 'Disabled (dev)'}
                            </span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-400" />
                        <span className="text-gray-400">
                            Analytics: <span className="text-white">
                                {features.enableAnalytics ? 'Enabled' : 'Disabled'}
                            </span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
