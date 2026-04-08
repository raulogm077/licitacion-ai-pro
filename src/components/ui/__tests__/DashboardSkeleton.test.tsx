import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DashboardSkeleton } from '../DashboardSkeleton';

describe('DashboardSkeleton Component', () => {
    it('renders skeleton correctly', () => {
        const { container } = render(<DashboardSkeleton />);
        // Ensure there are animated pulse elements
        expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);

        // Ensure main layout grids are rendered
        expect(container.querySelector('.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4')).toBeInTheDocument();
        expect(container.querySelector('.grid-cols-1.lg\\:grid-cols-3')).toBeInTheDocument();
    });
});
