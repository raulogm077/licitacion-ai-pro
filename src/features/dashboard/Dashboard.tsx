import { useState, useEffect } from 'react';
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

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty }
    } = useForm<LicitacionData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(LicitacionSchema) as any,
        defaultValues: data
    });

    // Reset form when new data arrives (if not currently editing)
    useEffect(() => {
        if (!isEditing) {
            reset(data);
        }
    }, [data, isEditing, reset]);

    const scrollToSection = (sectionId: string) => {
        setActiveSection(sectionId);
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

                {/* Right Column: Insights (Sticky) - 3 cols */}
                <aside className="hidden lg:block lg:col-span-3">
                    <InsightsPanel data={data} />
                </aside>

            </div>
        </form>
    );
}
