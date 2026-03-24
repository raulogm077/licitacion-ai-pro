import { useState, useMemo } from 'react';
import { LicitacionData } from '../../types';
import { buildPliegoVM } from './model/pliego-vm';

// New Sidebar UI Layout Components
import { Sidebar, Header, MainContent } from './components/layout';

// Data-driven chapter rendering
import { ChapterRenderer } from './components/detail/ChapterRenderer';
import { chapterConfigs } from './components/detail/chapter-config';
// TechnicalJsonModal is a utility modal, kept separately
import { TechnicalJsonModal } from './components/detail/ChapterComponentsPart2';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { FileText } from 'lucide-react';

interface DashboardProps {
    data: LicitacionData;
    onUpdate?: (newData: LicitacionData) => void;
    isLoading?: boolean;
}

export function Dashboard({ data, isLoading }: DashboardProps) {
    const [activeSection, setActiveSection] = useState('resumen');
    const [isJsonOpen, setIsJsonOpen] = useState(false);

    // Build View Model
    const vm = useMemo(() => buildPliegoVM(data), [data]);

    if (isLoading) return <DashboardSkeleton />;

    // Calculate dynamic alerts count for the sidebar badge
    const alertCount = vm.warnings.filter((w) => w.severity === 'CRITICO').length || vm.warnings.length;

    const renderActiveSection = () => {
        switch (activeSection) {
            case 'plantilla':
                return (
                    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                        <div className="max-w-[1100px] mx-auto bg-white rounded-lg shadow-sm border border-slate-200 p-8">
                            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Extracción Personalizada</h2>
                                    <p className="text-sm text-slate-500">
                                        Datos extraídos mediante la plantilla seleccionada
                                    </p>
                                </div>
                            </div>
                            <div className="bg-slate-950 text-slate-50 p-6 rounded-xl font-mono text-sm overflow-x-auto">
                                <pre>{JSON.stringify(vm.result.plantilla_personalizada, null, 2)}</pre>
                            </div>
                        </div>
                    </div>
                );
            case 'resumen':
                return <MainContent vm={vm} onNavigate={setActiveSection} />;
            case 'datos':
            case 'criterios':
            case 'solvencia':
            case 'tecnicos':
            case 'riesgos':
            case 'modelo': {
                const configId = activeSection === 'modelo' ? 'servicio' : activeSection;
                const chapterConfig = chapterConfigs.find((c) => c.id === configId);
                if (!chapterConfig) return <MainContent vm={vm} onNavigate={setActiveSection} />;
                return (
                    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                        <div className="max-w-[1100px] mx-auto bg-white rounded-lg shadow-sm border border-slate-200 p-8">
                            <ChapterRenderer config={chapterConfig} vm={vm} />
                        </div>
                    </div>
                );
            }
            default:
                return <MainContent vm={vm} onNavigate={setActiveSection} />;
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 font-sans mt-0 md:-mt-8">
            {/* Offset to account for HomePage wrapper padding usually,
                 since we transition to a full layout. -mt-8 removes default app padding */}
            <Sidebar
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                alertCount={alertCount}
                availableSections={vm.chapters.map((c) => c.id)}
            />

            <div className="flex flex-col flex-1 overflow-hidden">
                <Header vm={vm} />
                {renderActiveSection()}
            </div>

            {/* Kept modal available if needed via other triggers */}
            <TechnicalJsonModal vm={vm} isOpen={isJsonOpen} onClose={() => setIsJsonOpen(false)} />
        </div>
    );
}
