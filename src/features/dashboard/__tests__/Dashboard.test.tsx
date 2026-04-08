import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from '../Dashboard';
import { createMockLicitacionData } from '../../../test-utils/mock-pliego-data';

// Mock child components to isolate Dashboard logic
vi.mock('../components/layout', () => ({
    Sidebar: () => <div data-testid="sidebar" />,
    Header: () => <div data-testid="header" />,
    MainContent: () => <div data-testid="main-content" />,
}));

vi.mock('../components/detail/ChapterRenderer', () => ({
    ChapterRenderer: () => <div data-testid="chapter-renderer" />
}));

describe('Dashboard Component', () => {
    it('renders skeleton when loading', () => {
        const { container } = render(<Dashboard data={createMockLicitacionData()} isLoading={true} />);
        expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });

    it('renders main layout components when not loading', () => {
        render(<Dashboard data={createMockLicitacionData()} />);
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        expect(screen.getByTestId('header')).toBeInTheDocument();
        expect(screen.getByTestId('main-content')).toBeInTheDocument();
    });
});
