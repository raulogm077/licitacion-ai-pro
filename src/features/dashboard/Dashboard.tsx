import React, { useState } from 'react';
import { LicitacionData } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Download, Edit2, Save, X, Code } from 'lucide-react';
import { RequirementsMatrix } from './RequirementsMatrix';
import { exportToExcel, exportToJson } from '../../lib/export-utils';
import { GeneralInfoCard } from './components/GeneralInfoCard';
import { RisksCard } from './components/RisksCard';
import { SolvencyCard } from './components/SolvencyCard';

interface DashboardProps {
    data: LicitacionData;
    onUpdate?: (newData: LicitacionData) => void;
}

export function Dashboard({ data, onUpdate }: DashboardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState<LicitacionData>(data);

    // Update local state when prop changes (if not editing)
    React.useEffect(() => {
        if (!isEditing) setEditedData(data);
    }, [data, isEditing]);

    const handleSave = () => {
        if (onUpdate) onUpdate(editedData);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedData(data);
        setIsEditing(false);
    };

    const updateGeneral = (field: keyof LicitacionData['datosGenerales'], value: string | number) => {
        setEditedData(prev => ({
            ...prev,
            datosGenerales: {
                ...prev.datosGenerales,
                [field]: value
            }
        }));
    };

    const formatCurrency = (amount: number) => {
        if (!amount || amount === 0) return "N/A";
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: data.datosGenerales.moneda || 'EUR' }).format(amount);
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Header Actions */}
            <div className="flex justify-end gap-2">
                {isEditing ? (
                    <>
                        <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                            <X size={16} /> Cancelar
                        </button>
                        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
                            <Save size={16} /> Guardar Cambios
                        </button>
                    </>
                ) : (
                    <>
                        <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                            <Edit2 size={16} /> Editar
                        </button>
                        <div className="relative group">
                            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors shadow-sm">
                                <Download size={16} /> Exportar
                            </button>
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 hidden group-hover:block z-10">
                                <button onClick={() => exportToExcel(data, `analisis-${data.datosGenerales.titulo.substring(0, 20)}`)} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                    Excel (.xlsx)
                                </button>
                                <button onClick={() => exportToJson(data, `analisis-${data.datosGenerales.titulo.substring(0, 20)}`)} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                    JSON (.json)
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* General Info & Metrics */}
            <GeneralInfoCard
                data={data}
                isEditing={isEditing}
                editedData={editedData}
                onUpdateGeneral={updateGeneral}
                formatCurrency={formatCurrency}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Risks Section */}
                <RisksCard data={data} />

                {/* Solvency Section */}
                <SolvencyCard data={data} formatCurrency={formatCurrency} />
            </div>

            {/* Requirements Matrix */}
            <div className="h-[500px]">
                <RequirementsMatrix requirements={data.requisitosTecnicos.funcionales} />
            </div>

            {/* JSON Viewer Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Code size={20} className="text-slate-500" />
                        Datos Estructurados (JSON)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto font-mono text-sm max-h-[400px] overflow-y-auto border border-slate-800 shadow-inner">
                        <pre>{JSON.stringify(data, null, 2)}</pre>
                    </div>
                    <div className="mt-2 text-right">
                        <button
                            onClick={() => navigator.clipboard.writeText(JSON.stringify(data, null, 2))}
                            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                        >
                            Copiar JSON al portapapeles
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
