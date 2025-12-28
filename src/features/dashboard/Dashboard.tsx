import { Info } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LicitacionData } from '../../types';
import { formatCurrency } from '../../lib/formatters';
import { LicitacionSchema } from '../../lib/schemas';
import { RequirementsMatrix } from './RequirementsMatrix';
import { GeneralInfoCard } from './components/GeneralInfoCard';
import { RisksCard } from './components/RisksCard';
import { SolvencyCard } from './components/SolvencyCard';
import { DashboardActions } from './components/DashboardActions';
import { JsonViewer } from './components/JsonViewer';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { SectionNav } from './components/SectionNav';
import { InsightsPanel } from './components/InsightsPanel';

interface DashboardProps {
    data: LicitacionData;
    onUpdate?: (newData: LicitacionData) => void;
    isLoading?: boolean;
}

export function Dashboard({ data, onUpdate, isLoading }: DashboardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [activeSection, setActiveSection] = useState('general');
    const [selectedVersionId, setSelectedVersionId] = useState<number | undefined>(undefined);

    // Determines the data to display based on selected version
    const displayedData = React.useMemo(() => {
        if (!selectedVersionId) return data; // Default to current

        // Find the version content by ID
        const versionEnvelope = data.versions?.find(v => v.version === selectedVersionId);
        // The version envelope contains 'result', which is the actual data content LicitacionData.
        // Wait, versionEnvelope.result is supposed to be the content.
        // Let's check schemas/types. V1 logic says data.result | data.
        return versionEnvelope ? (versionEnvelope.result || data) : data;
    }, [data, selectedVersionId]);

    const isReadOnly = selectedVersionId !== undefined && selectedVersionId !== data.workflow?.current_version;
    const currentVersionUI = selectedVersionId || data.workflow?.current_version || (data.versions?.length || 1);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty }
    } = useForm<LicitacionData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(LicitacionSchema) as any,
        defaultValues: displayedData
    });

    // Reset form when displayed data changes
    useEffect(() => {
        if (!isEditing) {
            reset(displayedData);
        }
    }, [displayedData, isEditing, reset]);

    const scrollToSection = (sectionId: string) => {
        setActiveSection(sectionId);
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' }); // Removed block: 'start'
        }
    };

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    const onSubmit = (formData: LicitacionData) => {
        if (onUpdate) onUpdate(formData);
        setIsEditing(false);
    };

    const handleCancel = () => {
        reset(data);
        setIsEditing(false);
    };

    const getFormattedCurrency = (amount: number) => {
        if (!amount && amount !== 0) return "N/A";
        return formatCurrency(amount, data.datosGenerales.moneda);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[1600px] mx-auto pb-20 animate-in fade-in duration-500 px-4 sm:px-6">

            {/* Header Actions - Full Width */}
            <div className="mb-6">
                <DashboardActions
                    isEditing={isEditing}
                    isDirty={isDirty}
                    onEdit={() => setIsEditing(true)}
                    onCancel={handleCancel}
                    data={data}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* Left Column: Navigation (Sticky) - 2 cols */}
                <aside className="hidden lg:block lg:col-span-2">
                    <SectionNav
                        data={data}
                        activeSection={activeSection}
                        onSectionChange={scrollToSection}
                    />
                </aside>

                {/* Center Column: Main Content - 7 cols */}
                <main className="lg:col-span-7 space-y-8">

                    <section id="general" className="scroll-mt-24">
                        <GeneralInfoCard
                            data={data}
                            isEditing={isEditing}
                            register={register}
                            errors={errors}
                            formatCurrency={getFormattedCurrency}
                        />
                    </section>

                    <section id="riesgos" className="scroll-mt-24">
                        <RisksCard data={data} />
                    </section>

                    <section id="solvencia" className="scroll-mt-24">
                        <SolvencyCard data={data} formatCurrency={getFormattedCurrency} />
                    </section>

                    <section id="tecnicos" className="scroll-mt-24">
                        <RequirementsMatrix requirements={data.requisitosTecnicos.funcionales} />
                    </section>

                    {/* Placeholder for other sections if needed or merging them */}
                    <section id="json" className="pt-8 border-t border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Datos Técnicos (JSON)</h3>
                        <JsonViewer data={data} />
                    </section>

                </main>

                {/* Right Sidebar: Insights & Quality */}
                <div className="lg:col-span-3 space-y-6">
                    <InsightsPanel
                        data={data}
                        currentVersionId={currentVersionUI}
                        onVersionSelect={(vId) => setSelectedVersionId(vId)}
                    />
                </div>
            </div>

            {/* Read Only Banner */}
            {isReadOnly && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-slate-900/90 text-white rounded-full shadow-xl z-50 flex items-center gap-3 backdrop-blur-sm border border-slate-700">
                    <Info size={20} className="text-blue-400" />
                    <span>Estás viendo una <strong>versión histórica</strong> (Solo lectura).</span>
                    <button
                        onClick={() => setSelectedVersionId(undefined)}
                        className="ml-4 text-xs bg-white text-slate-900 px-3 py-1.5 rounded-full font-bold hover:bg-slate-200 transition-colors"
                    >
                        Volver a Actual
                    </button>
                </div>
            )}
        </form>
    );
}
