import { PliegoVM } from '../../model/pliego-vm';
import { AlertCircle, FileJson, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../components/ui/Dialog';
import { Button } from '../../../../components/ui/Button';

export function TechnicalJsonModal({ vm, isOpen, onClose }: { vm: PliegoVM; isOpen: boolean; onClose: () => void }) {
    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(vm.result, null, 2));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileJson className="w-5 h-5 text-slate-500" />
                        Datos Técnicos (JSON)
                    </DialogTitle>
                </DialogHeader>

                <div className="flex bg-slate-100 p-2 rounded-lg items-center gap-2 mb-2 text-xs text-slate-500">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                        Solo para depuración y soporte técnico. Esta es la estructura interna utilizada por el sistema.
                    </span>
                </div>

                <div className="flex-1 overflow-auto bg-slate-950 text-slate-50 p-4 rounded-lg font-mono text-xs shadow-inner">
                    <pre>{JSON.stringify(vm.result, null, 2)}</pre>
                </div>

                <div className="flex justify-end pt-4">
                    <Button variant="outline" onClick={handleCopy} className="gap-2">
                        <Copy className="w-4 h-4" /> Copiar JSON
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
