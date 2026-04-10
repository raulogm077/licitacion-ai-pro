import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnalyticsPage } from '../AnalyticsPage';

// Mock the lazy-loaded AnalyticsDashboard so React.lazy resolves synchronously
// in the Vitest/jsdom environment (dynamic imports work but async Suspense boundaries
// combined with real network calls cause timeouts in unit tests).
vi.mock('../../features/analytics/AnalyticsDashboard', () => ({
    AnalyticsDashboard: () => <div>No hay datos de analytics</div>,
}));

describe('AnalyticsPage', () => {
    it('renders analytics dashboard via Suspense', async () => {
        render(<AnalyticsPage />);

        // After Suspense resolves the lazy module, the mocked dashboard renders
        expect(await screen.findByText('No hay datos de analytics')).toBeInTheDocument();
    });
});
