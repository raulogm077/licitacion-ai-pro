import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Card, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Euro, Calendar, AlertCircle } from 'lucide-react';
import { LicitacionData } from '../../../types';
import { cn } from '../../../lib/utils';

interface GeneralInfoCardProps {
    data: LicitacionData;
    isEditing: boolean;
    register: UseFormRegister<LicitacionData>;
    errors: FieldErrors<LicitacionData>;
    formatCurrency: (amount: number) => string;
}

export function GeneralInfoCard({ data, isEditing, register, errors, formatCurrency }: GeneralInfoCardProps) {
    const hasFailed = data.metadata?.sectionStatus?.datosGenerales === 'failed';

    return (
        <div className="space-y-4">
            {hasFailed && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3 text-amber-800 text-sm animate-in slide-in-from-top-2 duration-300">
                    <AlertCircle size={18} className="shrink-0" />
                    <p><strong>Análisis Parcial:</strong> No se pudieron extraer algunos datos generales automáticamente. Por favor, revísalos manualmente.</p>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className={cn(errors.datosGenerales?.presupuesto && "ring-1 ring-red-500")}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-slate-500">Presupuesto Base</h3>
                            <Euro className="text-brand-500" size={20} />
                        </div>
                        {isEditing ? (
                            <div className="space-y-1">
                                <input
                                    type="number"
                                    {...register('datosGenerales.presupuesto', { valueAsNumber: true })}
                                    className="w-full text-2xl font-bold text-slate-900 border-b border-brand-200 focus:outline-none focus:border-brand-500 bg-transparent"
                                />
                                {errors.datosGenerales?.presupuesto && (
                                    <p className="text-[10px] text-red-500 flex items-center gap-1">
                                        <AlertCircle size={10} /> {errors.datosGenerales.presupuesto.message}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-slate-900">{formatCurrency(data.datosGenerales.presupuesto)}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">Sin impuestos</p>
                    </CardContent>
                </Card>

                <Card className={cn(errors.datosGenerales?.plazoEjecucionMeses && "ring-1 ring-red-500")}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-slate-500">Plazo Ejecución</h3>
                            <Calendar className="text-brand-500" size={20} />
                        </div>
                        {isEditing ? (
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        {...register('datosGenerales.plazoEjecucionMeses', { valueAsNumber: true })}
                                        className="w-20 text-2xl font-bold text-slate-900 border-b border-brand-200 focus:outline-none focus:border-brand-500 bg-transparent"
                                    />
                                    <span className="text-sm text-slate-500">Meses</span>
                                </div>
                                {errors.datosGenerales?.plazoEjecucionMeses && (
                                    <p className="text-[10px] text-red-500 flex items-center gap-1">
                                        <AlertCircle size={10} /> {errors.datosGenerales.plazoEjecucionMeses.message}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-slate-900">{data.datosGenerales.plazoEjecucionMeses} Meses</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">Duración estimada</p>
                    </CardContent>
                </Card>

                <Card className={cn("md:col-span-2", errors.datosGenerales?.titulo && "ring-1 ring-red-500")}>
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-medium text-slate-500 mb-2">Título del Expediente</h3>
                        {isEditing ? (
                            <div className="space-y-1">
                                <textarea
                                    {...register('datosGenerales.titulo')}
                                    className="w-full text-sm font-medium text-slate-900 border border-slate-200 rounded p-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                    rows={2}
                                />
                                {errors.datosGenerales?.titulo && (
                                    <p className="text-[10px] text-red-500 flex items-center gap-1">
                                        <AlertCircle size={10} /> {errors.datosGenerales.titulo.message}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-lg font-semibold text-slate-900 line-clamp-2 h-[56px]" title={data.datosGenerales.titulo}>
                                {data.datosGenerales.titulo || "Título no detectado (Editar para añadir)"}
                            </p>
                        )}
                        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
                            {data.datosGenerales.cpv.slice(0, 4).map((cpv, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] whitespace-nowrap">{cpv}</Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
