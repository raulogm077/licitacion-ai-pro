import { Card, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Euro, Calendar } from 'lucide-react';
import { LicitacionData } from '../../../types';

interface GeneralInfoCardProps {
    data: LicitacionData;
    isEditing: boolean;
    editedData: LicitacionData;
    onUpdateGeneral: (field: keyof LicitacionData['datosGenerales'], value: string | number) => void;
    formatCurrency: (amount: number) => string;
}

export function GeneralInfoCard({ data, isEditing, editedData, onUpdateGeneral, formatCurrency }: GeneralInfoCardProps) {
    return (
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
                            onChange={(e) => onUpdateGeneral('presupuesto', Number(e.target.value))}
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
                                onChange={(e) => onUpdateGeneral('plazoEjecucionMeses', Number(e.target.value))}
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
                            onChange={(e) => onUpdateGeneral('titulo', e.target.value)}
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
    );
}
