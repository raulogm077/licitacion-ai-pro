import { ChevronLeft, MoreHorizontal, FileText, File as FileIcon } from 'lucide-react'; // Removing FileSpreadsheet/FileJson to be safe
import { useNavigate } from 'react-router-dom';
import { exportToExcel, exportToJson } from '../../../../lib/export-utils';
import { exportToPDF } from '../../../../lib/pdf-export';
import { Button } from '../../../../components/ui/Button';
import { PliegoVM } from '../../model/pliego-vm';
import { Badge } from '../../../../components/ui/Badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../../../../components/ui/DropdownMenu';

interface StickyHeaderProps {
    vm: PliegoVM;
    onOpenJson: () => void;
}

export function StickyHeader({ vm, onOpenJson }: StickyHeaderProps) {
    const navigate = useNavigate();

    return (
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-all">
            <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between gap-4">

                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/')}
                        className="-ml-2 text-slate-500 hover:text-slate-900"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="sr-only">Volver</span>
                    </Button>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h1 className="text-lg font-semibold text-slate-900 dark:text-white truncate leading-tight">
                                {vm.display.titulo}
                            </h1>
                            <Badge variant={vm.quality.overall === 'COMPLETO' ? 'success' : vm.quality.overall === 'PARCIAL' ? 'warning' : 'secondary'} className="shrink-0 text-[10px] px-1.5 py-0 h-5">
                                {vm.quality.overall}
                            </Badge>
                        </div>
                        <p className="text-xs text-slate-500 truncate font-mono">
                            {vm.display.organo}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-8 h-8 p-0 rounded-full" data-testid="actions-menu-trigger">
                                <MoreHorizontal className="w-5 h-5 text-slate-500" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem
                                onClick={() => exportToExcel(vm.result, `analisis-${vm.display.titulo.substring(0, 20)}`)}
                                data-testid="export-excel-btn"
                            >
                                <FileText className="w-4 h-4 mr-2" /> Exportar Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => exportToJson(vm.result, `analisis-${vm.display.titulo.substring(0, 20)}`)}
                                data-testid="export-json-btn"
                            >
                                <FileText className="w-4 h-4 mr-2" /> Exportar JSON
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => exportToPDF(vm.result, `analisis-${vm.display.titulo.substring(0, 20)}`)}
                                data-testid="export-pdf-btn"
                            >
                                <FileIcon className="w-4 h-4 mr-2" /> Exportar PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={onOpenJson}>
                                <FileText className="w-4 h-4 mr-2" /> Ver datos técnicos (JSON)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button size="sm" className="hidden sm:flex bg-black text-white hover:bg-slate-800 rounded-full px-5 shadow-sm">
                        Generar Informe
                    </Button>
                </div>

            </div>
        </header>
    );
}
