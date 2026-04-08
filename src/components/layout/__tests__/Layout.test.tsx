import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Layout } from '../Layout';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../Header', () => ({
    Header: () => <div data-testid="header" />
}));

describe('Layout Component', () => {
    it('renders header and main content correctly', () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <Layout
                                status="IDLE"
                                data={null}
                                reset={vi.fn()}
                                darkMode={false}
                                setDarkMode={vi.fn()}
                                onLogout={vi.fn()}
                            />
                        }
                    >
                        <Route index element={<div data-testid="outlet-content">Content</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );
        expect(screen.getByTestId('header')).toBeInTheDocument();
        expect(screen.getByTestId('outlet-content')).toBeInTheDocument();
        expect(screen.getByText('Content')).toBeInTheDocument();
    });
});
