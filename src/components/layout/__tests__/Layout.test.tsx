import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Layout } from '../../layout/Layout';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../layout/Header', () => ({
    Header: () => <header>Mock Header</header>,
}));

describe('Layout', () => {
    it('renders children and header', () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route
                        element={
                            <Layout
                                onLogout={vi.fn()}
                                status="IDLE"
                                data={null}
                                reset={vi.fn()}
                                darkMode={false}
                                setDarkMode={vi.fn()}
                            />
                        }
                    >
                        <Route path="/" element={<div>Child Content</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText('Mock Header')).toBeInTheDocument();
        expect(screen.getByText('Child Content')).toBeInTheDocument();
    });
});
