import {
  LayoutDashboard,
  FileText,
  Award,
  Shield,
  Wrench,
  AlertTriangle,
  Settings,
  ChevronRight,
  Building2,
  LogOut,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: any;
  badge?: string | null;
}

const baseNavItems: NavItem[] = [
  {
    id: "plantilla",
    label: "Extracción Personalizada",
    icon: FileText,
  },
  {
    id: "resumen",
    label: "Resumen Ejecutivo",
    icon: LayoutDashboard,
  },
  {
    id: "datos",
    label: "Datos Generales",
    icon: FileText,
  },
  {
    id: "criterios",
    label: "Criterios de Adjudicación",
    icon: Award,
  },
  {
    id: "solvencia",
    label: "Solvencia",
    icon: Shield,
  },
  {
    id: "tecnicos",
    label: "Requisitos Técnicos",
    icon: Wrench,
  },
  {
    id: "riesgos",
    label: "Análisis de Riesgos",
    icon: AlertTriangle,
  },
  {
    id: "modelo",
    label: "Modelo de Servicio",
    icon: Settings,
  }];

interface SidebarProps {
  activeSection: string;
  onSectionChange: (id: string) => void;
  alertCount?: number;
}

export function Sidebar({ activeSection, onSectionChange, alertCount = 0, availableSections = [] }: SidebarProps & { availableSections?: string[] }) {
  const navItems = baseNavItems.filter(item => availableSections.length === 0 || availableSections.includes(item.id)).map(item => ({
      ...item,
      badge: item.id === 'riesgos' ? "3" : null
  }));
  // Utility to conditionally join classes since we don't have cn utility in scope easily
  const clx = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col h-screen bg-sidebar border-r border-sidebar-border shadow-xl z-20">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-cyan/15">
          <Building2 className="w-4 h-4 text-cyan" />
        </div>
        <div>
          <p className="text-sidebar-foreground font-semibold text-sm leading-tight tracking-wide">
            Analista de
          </p>
          <p className="text-cyan font-bold text-sm leading-tight tracking-wider uppercase">
            Pliegos
          </p>
        </div>
      </div>

      {/* Section label */}
      <div className="px-5 pt-5 pb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/40 select-none">
          Módulos de Análisis
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          // Dynamically set badge for riesgos
          const badgeText = item.id === 'riesgos' && alertCount > 0 ? alertCount.toString() : item.badge;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={clx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 group outline-none",
                isActive
                  ? "bg-sidebar-accent text-cyan shadow-inner"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <Icon
                className={clx(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  isActive
                    ? "text-cyan"
                    : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
                )}
              />
              <span className="flex-1 text-left leading-snug">
                {item.label}
              </span>
              {badgeText && (
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] px-1.5 py-0 rounded-full font-semibold">
                  {badgeText}
                </span>
              )}
              {isActive && (
                <ChevronRight className="w-3 h-3 text-cyan/60 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom section (Optional based on requirements, kept for UI fidelity) */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-navy-light border border-cyan/30 flex-shrink-0">
            <span className="text-[10px] font-bold text-cyan">IN</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sidebar-foreground text-xs font-semibold truncate">
              Minsait
            </p>
            <p className="text-sidebar-foreground/40 text-[10px] truncate">
              Equipo Analista
            </p>
          </div>
          <button className="text-sidebar-foreground/30 hover:text-sidebar-foreground/70 transition-colors outline-none">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
