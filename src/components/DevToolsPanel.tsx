import { useState } from 'react';
import { features } from '../config/features';
import { Zap } from 'lucide-react';
import { DevToolsActions } from './dev-tools/DevToolsActions';
import { DevToolsResults } from './dev-tools/DevToolsResults';
import { DevToolsStatus } from './dev-tools/DevToolsStatus';

/**
 * Dev Tools Panel for testing monitoring integrations
 * Only visible in development mode
 */
export function DevToolsPanel() {
    const [testResults, setTestResults] = useState<string[]>([]);

    if (!features.enableDevTools) {
        return null;
    }

    const addResult = (message: string) => {
        setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
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

            <DevToolsActions addResult={addResult} />
            <DevToolsResults testResults={testResults} clearResults={clearResults} />
            <DevToolsStatus />
        </div>
    );
}
