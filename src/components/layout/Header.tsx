import React, { useMemo } from 'react';
import { FileText, ArrowLeft, History, BarChart3, Search, Maximize2, Sun, Moon } from 'lucide-react';
import { View, ProcessingStatus, LicitacionData } from '../../types';

interface HeaderProps {
    view: View;
    setView: (view: View) => void;
    status: ProcessingStatus;
    data: LicitacionData | null;
    reset: () => void;
    darkMode: boolean;
    setDarkMode: (dark: boolean) => void;
    onPresentationMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    view,
    setView,
    status,
    data,
    reset,
    darkMode,
    setDarkMode,
    onPresentationMode
}) => {

    const navButton = useMemo(() => (target: View, icon: React.ReactNode, label: string) => {
        const isActive = view === target;
        return (
            <button
                onClick={() => setView(target)}
                title={label}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive
                    ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
            >
                {icon}
                <span className="text-sm font-medium hidden sm:inline">{label}</span>
            </button>
        );
    }, [view, setView]);

    const handleLogoClick = () => {
        reset();
        setView('HOME');
    };

    return (
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={handleLogoClick}>
                    <div className="bg-brand-600 p-1.5 rounded-lg">
                        <FileText className="text-white" size={20} />
                    </div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">
                        Licitación AI Pro
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    {view !== 'HOME' && (
                        <button
                            onClick={() => setView('HOME')}
                            title="Volver al inicio"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                        >
                            <ArrowLeft size={20} />
                            <span className="text-sm font-medium hidden sm:inline">Inicio</span>
                        </button>
                    )}

                    {navButton('HISTORY', <History size={20} />, 'Historial')}
                    {navButton('ANALYTICS', <BarChart3 size={20} />, 'Analytics')}
                    {navButton('SEARCH', <Search size={20} />, 'Búsqueda')}

                    {status === 'COMPLETED' && data && (
                        <button
                            onClick={onPresentationMode}
                            title="Modo Presentación"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                        >
                            <Maximize2 size={20} />
                            <span className="text-sm font-medium hidden sm:inline">Presentar</span>
                        </button>
                    )}

                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        title={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                    >
                        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </div>
        </header>
    );
};
