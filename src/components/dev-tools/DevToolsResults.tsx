interface DevToolsResultsProps {
    testResults: string[];
    clearResults: () => void;
}

export function DevToolsResults({ testResults, clearResults }: DevToolsResultsProps) {
    if (testResults.length === 0) {
        return null;
    }

    return (
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
    );
}
