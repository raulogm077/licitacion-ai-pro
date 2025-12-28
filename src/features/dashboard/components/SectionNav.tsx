import { LicitacionData } from '../../../types';
import { FileText, Shield, AlertTriangle, CheckCircle, Target, Zap } from 'lucide-react';

interface SectionNavProps {
    data: LicitacionData;
    activeSection: string;
    onSectionChange: (section: string) => void;
}

export function SectionNav({ data, activeSection, onSectionChange }: SectionNavProps) {
    const quality = data.workflow?.quality?.bySection;

    // Helper to get status color
    const getStatusColor = (sectionKey: string) => {
        if (!quality) return 'text-slate-400';
        const status = quality[sectionKey as keyof typeof quality];
        if (status === 'COMPLETO') return 'text-green-500';
        if (status === 'PARCIAL') return 'text-yellow-500';
        return 'text-slate-300';
    };

    const sections = [
        { id: 'general', label: 'Datos Generales', icon: FileText, key: 'datosGenerales' },
        { id: 'criterios', label: 'Criterios', icon: Target, key: 'criteriosAdjudicacion' },
        { id: 'solvencia', label: 'Solvencia', icon: Shield, key: 'requisitosSolvencia' },
        { id: 'tecnicos', label: 'Req. Técnicos', icon: CheckCircle, key: 'requisitosTecnicos' },
        { id: 'riesgos', label: 'Riesgos', icon: AlertTriangle, key: 'restriccionesYRiesgos' },
        { id: 'servicio', label: 'Servicio', icon: Zap, key: 'modeloServicio' },
    ];

    return (
        <nav className="space-y-1 sticky top-24">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-3">
                Secciones
            </h3>
            {sections.map((section) => (
                <button
                    key={section.id}
                    onClick={() => onSectionChange(section.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeSection === section.id
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <section.icon size={18} />
                        {section.label}
                    </div>
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(section.key)} bg-current`} />
                </button>
            ))}
        </nav>
    );
}
