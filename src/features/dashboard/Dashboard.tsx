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

interface DashboardProps {
    data: LicitacionData;
    onUpdate?: (newData: LicitacionData) => void;
    isLoading?: boolean;
}

export function Dashboard({ data, onUpdate, isLoading }: DashboardProps) {
    const [isEditing, setIsEditing] = useState(false);

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
        <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Header Actions */}
            <DashboardActions
                isEditing={isEditing}
                isDirty={isDirty}
                onEdit={() => setIsEditing(true)}
                onCancel={handleCancel}
                data={data}
            />

            {/* General Info & Metrics */}
            <GeneralInfoCard
                data={data}
                isEditing={isEditing}
                register={register}
                errors={errors}
                formatCurrency={getFormattedCurrency}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Risks Section */}
                <RisksCard data={data} />

                {/* Solvency Section */}
                <SolvencyCard data={data} formatCurrency={getFormattedCurrency} />
            </div>

            {/* Requirements Matrix */}
            <div className="h-[500px]">
                <RequirementsMatrix requirements={data.requisitosTecnicos.funcionales} />
            </div>

            {/* JSON Viewer Section */}
            <JsonViewer data={data} />
        </form>
    );
}
