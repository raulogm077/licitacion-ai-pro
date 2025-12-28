import React, { useState } from 'react';
import { LicitacionData } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { AlertTriangle, CheckCircle, Euro, Calendar, ShieldAlert, Download, Edit2, Save, X, Code } from 'lucide-react';
import { RequirementsMatrix } from './RequirementsMatrix';
import { exportToExcel, exportToJson } from '../../lib/export-utils';

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
                                <button onClick={() => exportToExcel(data, `analisis - ${data.datosGenerales.titulo.substring(0, 20)} `)} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                    Excel (.xlsx)
                                </button>
                                <button onClick={() => exportToJson(data, `analisis - ${data.datosGenerales.titulo.substring(0, 20)} `)} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                    JSON (.json)
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-slate-500">Presupuesto Base</h3>
                            <Euro className="text-brand-500" size={20} />
                        </div>
                        {isEditing ? (
                            <input
                                type="number"
                                value={editedData.datosGenerales.presupuesto}
                                onChange={(e) => updateGeneral('presupuesto', Number(e.target.value))}
                                className="w-full text-2xl font-bold text-slate-900 border-b border-brand-200 focus:outline-none focus:border-brand-500"
                            />
                        ) : (
                            <p className="text-2xl font-bold text-slate-900">{formatCurrency(data.datosGenerales.presupuesto)}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">Sin impuestos</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-slate-500">Plazo Ejecución</h3>
                            <Calendar className="text-brand-500" size={20} />
                        </div>
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={editedData.datosGenerales.plazoEjecucionMeses}
                                    onChange={(e) => updateGeneral('plazoEjecucionMeses', Number(e.target.value))}
                                    className="w-20 text-2xl font-bold text-slate-900 border-b border-brand-200 focus:outline-none focus:border-brand-500"
                                />
                                <span className="text-sm text-slate-500">Meses</span>
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-slate-900">{data.datosGenerales.plazoEjecucionMeses} Meses</p>
                        )}
                        <div className="text-2xl font-bold text-slate-900">{data.criteriosAdjudicacion.objetivos.length + data.criteriosAdjudicacion.subjetivos.length}</div>
                        <p className="text-xs text-slate-400 mt-1">Duración estimada</p>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-medium text-slate-500 mb-2">Título del Expediente</h3>
                        {isEditing ? (
                            <textarea
                                value={editedData.datosGenerales.titulo}
                                onChange={(e) => updateGeneral('titulo', e.target.value)}
                                className="w-full text-lg font-semibold text-slate-900 border border-slate-200 rounded p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                rows={2}
                            />
                        ) : (
                            <p className="text-lg font-semibold text-slate-900 line-clamp-2" title={data.datosGenerales.titulo}>
                                {data.datosGenerales.titulo || "Título no detectado (Editar para añadir)"}
                            </p>
                        )}
                        <div className="flex gap-2 mt-3">
                            {data.datosGenerales.cpv.slice(0, 3).map((cpv, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{cpv}</Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Risks Section */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldAlert size={20} className="text-danger-500" />
                            Riesgos Detectados
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.restriccionesYRiesgos.killCriteria.length > 0 && (
                                <div className="bg-danger-50 p-4 rounded-lg">
                                    <h4 className="text-sm font-bold text-danger-800 mb-2 uppercase tracking-wide">Kill Criteria (Exclusiones)</h4>
                                    <ul className="list-disc list-inside text-sm text-danger-700 space-y-1">
                                        {data.restriccionesYRiesgos.killCriteria.map((criteria, idx) => (
                                            <li key={idx}>{criteria}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="space-y-3">
                                {data.restriccionesYRiesgos.riesgos.map((riesgo, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                        <AlertTriangle
                                            size={18}
                                            className={`mt - 2 p - 3 rounded - lg text - sm ${riesgo.impacto === 'CRITICO' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'} `}
                                        />
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-sm font-medium text-slate-900">{riesgo.descripcion}</h4>
                                                <Badge variant={
                                                    riesgo.impacto === 'CRITICO' ? 'danger' :
                                                        riesgo.impacto === 'ALTO' ? 'warning' : 'default'
                                                }>
                                                    {riesgo.impacto}
                                                </Badge>
                                            </div>
                                            {riesgo.mitigacionSugerida && (
                                                <p className="text-xs text-slate-500 mt-1">
                                                    <span className="font-medium">Sugerencia:</span> {riesgo.mitigacionSugerida}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {data.restriccionesYRiesgos.riesgos.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-6 text-center">
                                        <ShieldAlert className="text-slate-300 mb-2" size={32} />
                                        <p className="text-sm text-slate-500 italic">No se detectaron riesgos explícitos.</p>
                                        <p className="text-xs text-slate-400">La IA no encontró cláusulas críticas en el extracto.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Solvency Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle size={20} className="text-success-500" />
                            Requisitos de Solvencia
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-sm font-medium text-slate-500 mb-3 uppercase tracking-wider">Económica</h4>
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                    <p className="text-sm text-slate-600">Cifra de Negocio Anual Mínima</p>
                                    <p className="text-xl font-bold text-slate-900 mt-1">
                                        {formatCurrency(data.requisitosSolvencia.economica.cifraNegocioAnualMinima)}
                                    </p>
                                    {data.requisitosSolvencia.economica.descripcion && (
                                        <span className="font-medium text-slate-900">{data.requisitosTecnicos.funcionales.length} requisitos</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-medium text-slate-500 mb-3 uppercase tracking-wider">Técnica</h4>
                                <div className="space-y-3">
                                    {data.requisitosSolvencia.tecnica.map((req, idx) => (
                                        <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <p className="text-sm font-medium text-slate-900">{req.descripcion}</p>
                                            <div className="flex gap-4 mt-2 text-xs text-slate-500">
                                                <span>Proyectos similares: <strong>{req.proyectosSimilaresRequeridos}</strong></span>
                                                {req.importeMinimoProyecto && (
                                                    <span>Importe mín: <strong>{formatCurrency(req.importeMinimoProyecto)}</strong></span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
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
