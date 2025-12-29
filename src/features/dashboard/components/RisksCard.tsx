import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { AlertTriangle, ShieldAlert, AlertCircle, Quote } from 'lucide-react';
import { LicitacionData } from '../../../types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../components/ui/Tooltip';

interface RisksCardProps {
    data: LicitacionData;
}

export function RisksCard({ data }: RisksCardProps) {
    return (
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShieldAlert size={20} className="text-danger-500" />
                        Riesgos Detectados
                    </div>
                    {data.metadata?.sectionStatus?.restriccionesYRiesgos === 'failed' && (
                        <Badge variant="warning" className="flex items-center gap-1">
                            <AlertCircle size={12} /> Análisis Fallido
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {data.restriccionesYRiesgos.killCriteria.length > 0 && (
                        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                            <h4 className="text-sm font-bold text-red-800 dark:text-red-300 mb-2 uppercase tracking-wide">Kill Criteria (Exclusiones)</h4>
                            <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
                                {data.restriccionesYRiesgos.killCriteria.map((criteria, idx) => (
                                    <li key={idx}>{criteria}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="space-y-3">
                        {data.restriccionesYRiesgos.riesgos.map((riesgo, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                <div className={`p-2 rounded-lg ${riesgo.impacto === 'CRITICO' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'}`}>
                                    <AlertTriangle size={18} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-sm font-medium text-slate-900 dark:text-white">{riesgo.descripcion}</h4>
                                        <Badge variant={
                                            riesgo.impacto === 'CRITICO' ? 'danger' :
                                                riesgo.impacto === 'ALTO' ? 'warning' : 'default'
                                        }>
                                            {riesgo.impacto}
                                        </Badge>
                                        {riesgo.cita && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Quote size={14} className="text-slate-400 hover:text-brand-500 cursor-pointer transition-colors ml-1" />
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-xs text-xs italic bg-slate-800 text-white border-slate-700">
                                                        "{riesgo.cita}"
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                    {riesgo.mitigacionSugerida && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
    );
}
