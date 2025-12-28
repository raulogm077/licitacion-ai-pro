import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { LicitacionData } from '../../../types';

interface SolvencyCardProps {
    data: LicitacionData;
    formatCurrency: (amount: number) => string;
}

export function SolvencyCard({ data, formatCurrency }: SolvencyCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircle size={20} className="text-success-500" />
                        Requisitos de Solvencia
                    </div>
                    {data.metadata?.sectionStatus?.requisitosSolvencia === 'failed' && (
                        <div className="text-[10px] bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                            <AlertCircle size={10} /> Revisión Manual
                        </div>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    <div>
                        <h4 className="text-sm font-medium text-slate-500 mb-3 uppercase tracking-wider">Económica</h4>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                            <p className="text-sm text-slate-600 dark:text-slate-400">Cifra de Negocio Anual Mínima</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                                {formatCurrency(data.requisitosSolvencia.economica.cifraNegocioAnualMinima)}
                            </p>
                            {data.requisitosSolvencia.economica.descripcion && (
                                <p className="text-xs text-slate-500 mt-2">{data.requisitosSolvencia.economica.descripcion}</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-medium text-slate-500 mb-3 uppercase tracking-wider">Técnica</h4>
                        <div className="space-y-3">
                            {data.requisitosSolvencia.tecnica.map((req, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{req.descripcion}</p>
                                    <div className="flex gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
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
    );
}
