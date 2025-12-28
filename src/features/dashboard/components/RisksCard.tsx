import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { LicitacionData } from '../../../types';

interface RisksCardProps {
    data: LicitacionData;
}

export function RisksCard({ data }: RisksCardProps) {
    return (
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
                                    className={`mt-2 p-3 rounded-lg text-sm ${riesgo.impacto === 'CRITICO' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}
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
    );
}
