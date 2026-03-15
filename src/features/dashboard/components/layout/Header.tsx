import { Download, CheckCircle2, ChevronRight, FileText } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { PliegoVM } from "../../model/pliego-vm";

interface HeaderProps {
    vm: PliegoVM;
}

export function Header({ vm }: HeaderProps) {
    return (
        <header
            className="flex items-center justify-between px-6 py-4 bg-white border-b border-border flex-shrink-0 z-10 sticky top-0"
            style={{ boxShadow: "0 1px 3px rgba(0,28,61,0.06)" }}
        >
            {/* Breadcrumb + Title */}
            <div className="flex flex-col gap-1 min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 select-none">
                    <span className="hover:text-slate-900 cursor-pointer transition-colors">
                        Licitaciones
                    </span>
                    <ChevronRight className="w-3 h-3" />
                    <span className="hover:text-slate-900 cursor-pointer transition-colors">
                        Análisis Reciente
                    </span>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-slate-900 font-medium truncate">
                        {vm.result.datosGenerales.organoContratacion || 'Pliego Actual'}
                    </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-base font-bold text-slate-900 leading-tight truncate max-w-3xl">
                        {vm.display.titulo}
                    </h1>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {(vm.result.datosGenerales as Record<string, unknown>).numeroExpediente as string && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono tracking-wider border border-slate-200 text-slate-500 bg-slate-50">
                                {(vm.result.datosGenerales as Record<string, unknown>).numeroExpediente as string}
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-semibold px-2 py-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Analizado
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                    variant="outline"
                    className="h-8 text-xs font-semibold gap-2 hidden sm:flex border-slate-200"
                    onClick={() => {
                        alert("Export functionality placeholder");
                    }}
                >
                    <FileText className="w-3.5 h-3.5" />
                    Ver Original
                </Button>
                <Button
                    className="h-8 gap-2 text-xs font-semibold bg-navy text-white hover:bg-navy-mid border-0 shadow-sm transition-all duration-150"
                    onClick={() => {
                        alert("Export Report functionality placeholder");
                    }}
                >
                    <Download className="w-3.5 h-3.5" />
                    Exportar Reporte
                </Button>
            </div>
        </header>
    );
}
