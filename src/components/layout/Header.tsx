import React, { useCallback } from 'react';
import { FileText, ArrowLeft, History, BarChart3, Search, Maximize2, Sun, Moon, LogIn, Layers } from 'lucide-react';
import { ProcessingStatus, LicitacionData } from '../../types';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { UserMenu } from '../ui/UserMenu';

interface HeaderProps {
    status: ProcessingStatus;
    data: LicitacionData | null;
    reset: () => void;
    darkMode: boolean;
    setDarkMode: (dark: boolean) => void;
    onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ status, data, reset, darkMode, setDarkMode, onLogout }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const navButton = useCallback(
        (path: string, icon: React.ReactNode, label: string) => {
            const isActive = location.pathname === path;
            return (
                <button
                    onClick={() => navigate(path)}
                    title={label}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                            ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                >
                    {icon}
                    <span className="text-sm font-medium hidden sm:inline">{label}</span>
                </button>
            );
        },
        [location.pathname, navigate]
    );

    const handleLogoClick = () => {
        reset();
        navigate('/');
    };

    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    return (
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={handleLogoClick}>
                    <div className="bg-brand-600 p-1.5 rounded-lg">
                        <FileText className="text-white" size={20} />
                    </div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">
                        Analista de Pliegos
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    {location.pathname !== '/' && (
                        <button
                            onClick={() => navigate('/')}
                            title="Volver al inicio"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                        >
                            <ArrowLeft size={20} />
                            <span className="text-sm font-medium hidden sm:inline">Inicio</span>
                        </button>
                    )}

                    {navButton('/history', <History size={20} />, 'Historial')}
                    {navButton('/templates', <Layers size={20} />, 'Plantillas')}
                    {navButton('/analytics', <BarChart3 size={20} />, 'Analytics')}
                    {navButton('/search', <Search size={20} />, 'Búsqueda')}

                    {status === 'COMPLETED' && data && (
                        <button
                            onClick={() => navigate('/presentation')}
                            title="Modo Presentación"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                        >
                            <Maximize2 size={20} />
                            <span className="text-sm font-medium hidden sm:inline">Presentar</span>
                        </button>
                    )}

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />

                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                    >
                        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>

                    {/* Show UserMenu if authenticated, else show login button */}
                    {isAuthenticated ? (
                        <UserMenu />
                    ) : (
                        <button
                            onClick={onLogout}
                            title="Iniciar sesión"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-medium transition-all shadow-lg shadow-brand-500/30"
                        >
                            <LogIn size={18} />
                            <span className="text-sm hidden sm:inline">Iniciar sesión</span>
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};
