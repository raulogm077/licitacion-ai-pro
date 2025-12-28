import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { CheckCircle } from 'lucide-react';
import { LicitacionData } from '../../../types';

interface SolvencyCardProps {
    data: LicitacionData;
    formatCurrency: (amount: number) => string;
}

export function SolvencyCard({ data, formatCurrency }: SolvencyCardProps) {
    return (
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
                                <p className="text-xs text-slate-500 mt-2">{data.requisitosSolvencia.economica.descripcion}</p>
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
    );
}
