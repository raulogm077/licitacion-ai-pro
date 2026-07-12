import { useState } from 'react';
import { Download, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import { unwrap } from '../../../../lib/tracked-field';
import { Button } from '../../../../components/ui/Button';
import { PliegoVM } from '../../model/pliego-vm';
import { exportLicitacionToExcel } from '../../../../lib/export-utils';
import { notify } from '../../../../lib/notify';
import { logger } from '../../../../services/logger';

interface HeaderProps {
    vm: PliegoVM;
}

export function Header({ vm }: HeaderProps) {
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        setExporting(true);
        try {
            const slug = (vm.display.titulo || 'licitacion')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .slice(0, 60);
            await exportLicitacionToExcel(vm.result, `informe-${slug}`);
            notify.success('Informe exportado', 'El archivo .xlsx se ha descargado.');
        } catch (error) {
            logger.error('Export failed:', error);
            notify.error('No se pudo exportar el informe');
        } finally {
            setExporting(false);
        }
    };

    return (
        <header className="sticky top-0 z-10 flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
            {/* Breadcrumb + Title */}
            <div className="flex min-w-0 flex-1 flex-col gap-1 pr-4">
                <div className="flex select-none items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>Licitaciones</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>Análisis Reciente</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {unwrap(vm.result.datosGenerales.organoContratacion) || 'Pliego Actual'}
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="max-w-3xl truncate text-base font-bold leading-tight text-slate-900 dark:text-white">
                        {vm.display.titulo}
                    </h1>
                    <div className="flex flex-shrink-0 items-center gap-2">
                        {(() => {
                            const expediente = (vm.result.datosGenerales as Record<string, unknown>)?.numeroExpediente;
                            return typeof expediente === 'string' && expediente ? (
                                <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                    {expediente}
                                </span>
                            ) : null;
                        })()}
                        <span className="inline-flex items-center gap-1 rounded border border-success/30 bg-success-light px-2 py-0.5 text-[10px] font-semibold text-success-dark dark:bg-success/20 dark:text-success-light">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Analizado
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-shrink-0 items-center gap-2">
                <Button className="h-8 gap-2 text-xs font-semibold" onClick={handleExport} disabled={exporting}>
                    {exporting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Download className="h-3.5 w-3.5" />
                    )}
                    Exportar Reporte
                </Button>
            </div>
        </header>
    );
}
