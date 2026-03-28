import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const AnalyticsDashboard = lazy(() =>
    import('../features/analytics/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard }))
);

export const AnalyticsPage: React.FC = () => (
    <Suspense fallback={<Loader2 className="animate-spin" />}>
        <AnalyticsDashboard />
    </Suspense>
);
