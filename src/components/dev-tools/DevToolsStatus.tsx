import { CheckCircle } from 'lucide-react';
import { features } from '../../config/features';

export function DevToolsStatus() {
    return (
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
    );
}
