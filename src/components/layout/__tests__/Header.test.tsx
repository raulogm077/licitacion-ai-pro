import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Header } from '../Header';
import { BrowserRouter } from 'react-router-dom';

// Setup router mock
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useLocation: () => ({ pathname: '/' })
    };
});

describe('Header Component', () => {
    it('renders logo and navigation items', () => {
        render(
            <BrowserRouter>
                <Header
                    status="IDLE"
                    data={null}
                    reset={vi.fn()}
                    darkMode={false}
                    setDarkMode={vi.fn()}
                    onLogout={vi.fn()}
                />
            </BrowserRouter>
        );
        expect(screen.getByText('Analista de Pliegos')).toBeInTheDocument();
        expect(screen.getByText('Historial')).toBeInTheDocument();
        expect(screen.getByText('Plantillas')).toBeInTheDocument();
    });

    it('handles navigation clicks', () => {
        render(
            <BrowserRouter>
                <Header
                    status="IDLE"
                    data={null}
                    reset={vi.fn()}
                    darkMode={false}
                    setDarkMode={vi.fn()}
                    onLogout={vi.fn()}
                />
            </BrowserRouter>
        );
        fireEvent.click(screen.getByRole('button', { name: /Historial/i }));
        expect(mockNavigate).toHaveBeenCalledWith('/history');
    });

    it('shows presentation button when status is COMPLETED and data exists', () => {
        render(
            <BrowserRouter>
                <Header
                    status="COMPLETED"
                    data={{ hash: '123' } as any}
                    reset={vi.fn()}
                    darkMode={false}
                    setDarkMode={vi.fn()}
                    onLogout={vi.fn()}
                />
            </BrowserRouter>
        );
        expect(screen.getByText('Presentar')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Presentar/i }));
        expect(mockNavigate).toHaveBeenCalledWith('/presentation');
    });

    it('toggles dark mode', () => {
        const setDarkMode = vi.fn();
        render(
            <BrowserRouter>
                <Header
                    status="IDLE"
                    data={null}
                    reset={vi.fn()}
                    darkMode={false}
                    setDarkMode={setDarkMode}
                    onLogout={vi.fn()}
                />
            </BrowserRouter>
        );
        fireEvent.click(screen.getByTitle('Cambiar a modo oscuro'));
        expect(setDarkMode).toHaveBeenCalledWith(true);
    });

    it('handles logout click', () => {
        const onLogout = vi.fn();
        render(
            <BrowserRouter>
                <Header
                    status="IDLE"
                    data={null}
                    reset={vi.fn()}
                    darkMode={false}
                    setDarkMode={vi.fn()}
                    onLogout={onLogout}
                />
            </BrowserRouter>
        );
        fireEvent.click(screen.getByRole('button', { name: /Iniciar sesión/i }));
        expect(onLogout).toHaveBeenCalled();
    });
});
