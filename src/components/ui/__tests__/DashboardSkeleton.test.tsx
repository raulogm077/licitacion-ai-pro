import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DashboardSkeleton } from '../DashboardSkeleton';

describe('DashboardSkeleton Component', () => {
    it('renders skeleton correctly', () => {
        const { container } = render(<DashboardSkeleton />);
        // Use direct children/class searches without backslashes or just check children length
        expect(container.firstChild).toBeInTheDocument();
        expect((container.firstChild as HTMLElement).classList.contains('space-y-8')).toBe(true);

        // Assert there are shimmering elements
        const shimmers = container.querySelectorAll('.animate-pulse');
        expect(shimmers.length).toBeGreaterThan(0);
    });
});
