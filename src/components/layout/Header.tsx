import React, { useMemo } from 'react';
import { FileSearch, History, BarChart3, Search, Maximize2, Sun, Moon, LogIn, Bell } from 'lucide-react';
import { ProcessingStatus, LicitacionData } from '../../types';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { UserMenu } from '../ui/UserMenu';
import { Badge } from '../ui/Badge';

interface HeaderProps {
    status: ProcessingStatus;
    data: LicitacionData | null;
    reset: () => void;
    darkMode: boolean;
    setDarkMode: (dark: boolean) => void;
    onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    status,
    data,
    reset,
    darkMode,
    setDarkMode,
    onLogout,
}) => {
    const location = useLocation();
    const navigate = useNavigate();

    const navButton = useMemo(() => (path: string, icon: React.ReactNode, label: string) => {
        const isActive = location.pathname === path;
        return (
            <button
                onClick={() => navigate(path)}
                title={label}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive
                    ? 'bg-white/10 text-cyan'
                    : 'hover:bg-white/5 text-white/70 hover:text-white'
                    }`}
            >
                {icon}
                <span className="text-sm font-medium hidden sm:inline">{label}</span>
            </button>
        );
    }, [location.pathname, navigate]);

    const handleLogoClick = () => {
        reset();
        navigate('/');
    };

    return (
        <header
            className="w-full h-16 flex items-center justify-between px-6 md:px-10 shadow-sm z-50 sticky top-0"
            style={{ backgroundColor: "var(--brand-navy)", zIndex: 60 }} // Highest z-index to stay above sidebar
        >
            {/* Logo */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={handleLogoClick}>
                <div
                    className="flex items-center justify-center w-9 h-9 rounded-lg"
                    style={{ backgroundColor: "var(--brand-cyan)" }}
                >
                    <FileSearch className="w-5 h-5" style={{ color: "var(--brand-navy)" }} />
                </div>
                <div className="flex flex-col leading-tight">
                    <span className="text-white font-semibold text-base tracking-tight font-sans">
                        Analista de Pliegos
                    </span>
                    <span className="text-xs font-sans" style={{ color: "var(--brand-cyan)" }}>
                        by Minsait
                    </span>
                </div>
            </div>

            {/* Main Nav Items */}
            <div className="flex items-center gap-2">
                {navButton('/history', <History size={18} />, 'Historial')}
                {navButton('/analytics', <BarChart3 size={18} />, 'Analytics')}
                {navButton('/search', <Search size={18} />, 'Búsqueda')}

                {status === 'COMPLETED' && data && (
                    <button
                        onClick={() => navigate('/presentation')}
                        title="Modo Presentación"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white transition-colors"
                    >
                        <Maximize2 size={18} />
                        <span className="text-sm font-medium hidden sm:inline">Presentar</span>
                    </button>
                )}

                <div className="h-6 w-px bg-white/20 mx-2" />

                {/* Right side nav / User actions */}
                <Badge
                    variant="outline"
                    className="hidden lg:flex border text-xs font-medium px-2.5 py-1 mr-2"
                    style={{
                        borderColor: "rgba(0,229,255,0.35)",
                        color: "var(--brand-cyan)",
                        backgroundColor: "rgba(0,229,255,0.08)",
                    }}
                >
                    Plan Pro
                </Badge>

                <button
                    className="relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-white/10 mr-2"
                    aria-label="Notificaciones"
                >
                    <Bell className="w-[18px] h-[18px] text-white/70" />
                    <span
                        className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: "var(--brand-cyan)" }}
                    />
                </button>

                <button
                    onClick={() => setDarkMode(!darkMode)}
                    title={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                    className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors mr-2"
                >
                    {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                {/* Show UserMenu if authenticated, else show login button */}
                {useAuthStore(state => state.isAuthenticated) ? (
                    <div className="bg-white/5 rounded-lg">
                        {/* We use the existing UserMenu but it might need light text adaptations, we'll see */}
                        <UserMenu />
                    </div>
                ) : (
                    <button
                        onClick={onLogout}
                        title="Iniciar sesión"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg"
                        style={{ backgroundColor: "var(--brand-cyan)", color: "var(--brand-navy)" }}
                    >
                        <LogIn size={16} />
                        <span className="text-sm font-bold hidden sm:inline">Iniciar sesión</span>
                    </button>
                )}
            </div>
        </header>
    );
};
