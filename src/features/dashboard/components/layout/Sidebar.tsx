import {
    LayoutDashboard,
    FileText,
    Award,
    Shield,
    MessageSquare,
    Wrench,
    AlertTriangle,
    Settings,
    ChevronRight,
    LogOut,
    type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../../../stores/auth.store';
import { cn } from '../../../../lib/utils';

interface NavItem {
    id: string;
    label: string;
    icon: LucideIcon;
    badge?: string | null;
}

const baseNavItems: NavItem[] = [
    {
        id: 'plantilla',
        label: 'Extracción Personalizada',
        icon: FileText,
    },
    {
        id: 'resumen',
        label: 'Resumen Ejecutivo',
        icon: LayoutDashboard,
    },
    {
        id: 'chat',
        label: 'Copiloto IA',
        icon: MessageSquare,
    },
    {
        id: 'datos',
        label: 'Datos Generales',
        icon: FileText,
    },
    {
        id: 'criterios',
        label: 'Criterios de Adjudicación',
        icon: Award,
    },
    {
        id: 'solvencia',
        label: 'Solvencia',
        icon: Shield,
    },
    {
        id: 'tecnicos',
        label: 'Requisitos Técnicos',
        icon: Wrench,
    },
    {
        id: 'riesgos',
        label: 'Análisis de Riesgos',
        icon: AlertTriangle,
    },
    {
        id: 'servicio',
        label: 'Modelo de Servicio',
        icon: Settings,
    },
];

interface SidebarProps {
    activeSection: string;
    onSectionChange: (id: string) => void;
    alertCount?: number;
}

export function Sidebar({
    activeSection,
    onSectionChange,
    alertCount = 0,
    availableSections = [],
}: SidebarProps & { availableSections?: string[] }) {
    const { user, signOut } = useAuthStore();
    const navItems = baseNavItems
        .filter((item) => availableSections.length === 0 || availableSections.includes(item.id))
        .map((item) => ({ ...item }));

    return (
        <aside className="z-20 flex h-screen w-64 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-950 shadow-xl">
            {/* Logo / Brand */}
            <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient shadow-glow">
                    <FileText className="h-4 w-4 text-white" />
                </div>
                <div>
                    <p className="text-sm font-semibold leading-tight tracking-wide text-slate-100">Analista de</p>
                    <p className="font-display text-sm font-bold uppercase leading-tight tracking-wider text-gradient">
                        Pliegos
                    </p>
                </div>
            </div>

            {/* Section label */}
            <div className="px-5 pb-2 pt-5">
                <p className="select-none text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Módulos de Análisis
                </p>
            </div>

            {/* Navigation */}
            <nav className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    // Dynamically set badge for riesgos
                    const badgeText = item.id === 'riesgos' && alertCount > 0 ? alertCount.toString() : item.badge;

                    return (
                        <button
                            key={item.id}
                            onClick={() => onSectionChange(item.id)}
                            className={cn(
                                'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-all duration-150',
                                isActive
                                    ? 'bg-brand-500/15 text-brand-300 shadow-inner'
                                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                            )}
                        >
                            <Icon
                                className={cn(
                                    'h-4 w-4 flex-shrink-0 transition-colors',
                                    isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'
                                )}
                            />
                            <span className="flex-1 text-left leading-snug">{item.label}</span>
                            {badgeText && (
                                <span className="rounded-full border border-warning/30 bg-warning/20 px-1.5 py-0 text-[10px] font-semibold text-warning">
                                    {badgeText}
                                </span>
                            )}
                            {isActive && <ChevronRight className="h-3 w-3 flex-shrink-0 text-brand-400/60" />}
                        </button>
                    );
                })}
            </nav>

            {/* Signed-in user */}
            {user?.email && (
                <div className="space-y-1 border-t border-slate-800 p-3">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-gradient">
                            <span className="text-[10px] font-bold uppercase text-white">{user.email.charAt(0)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-slate-200">{user.email}</p>
                            <p className="truncate text-[10px] text-slate-500">Sesión activa</p>
                        </div>
                        <button
                            onClick={() => signOut()}
                            title="Cerrar sesión"
                            aria-label="Cerrar sesión"
                            className="text-slate-500 outline-none transition-colors hover:text-slate-200"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </aside>
    );
}
