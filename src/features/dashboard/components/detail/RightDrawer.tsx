
import { PliegoVM } from '../../model/pliego-vm';
import { Button } from '../../../../components/ui/Button';
import { X, Pin, AlertTriangle, BookOpen, ListTodo, FileSearch } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../components/ui/Tabs';
import { AvisosTab, EvidenciasTab, NotasTab, ProgresoTab } from './RightDrawerTabs';

interface RightDrawerProps {
    vm: PliegoVM;
    isOpen: boolean;
    isPinned: boolean;
    onClose: () => void;
    onPinToggle: () => void;
    onSaveNote: (text: string) => void;
    onReanalyze: () => void;
}

export function RightDrawer({ vm, isOpen, isPinned, onClose, onPinToggle, onSaveNote, onReanalyze }: RightDrawerProps) {
    if (!isOpen && !isPinned) return null;

    return (
        <aside
            className={`
                fixed top-16 bottom-0 right-0 z-20 bg-white border-l border-slate-200 shadow-xl transition-all duration-300
                ${isPinned ? 'w-80 translate-x-0' : isOpen ? 'w-80 translate-x-0' : 'w-80 translate-x-full'}
            `}
        >
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="h-12 border-b border-slate-100 flex items-center justify-between px-4">
                    <span className="font-semibold text-sm text-slate-700">Herramientas</span>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onPinToggle}>
                            {isPinned ? <Pin className="w-4 h-4 text-brand-600 fill-brand-600" /> : <Pin className="w-4 h-4 text-slate-400" />}
                        </Button>
                        {!isPinned && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="avisos" className="flex-1 flex flex-col">
                    <div className="px-2 pt-2">
                        <TabsList className="w-full grid grid-cols-4 h-9">
                            <TabsTrigger value="avisos" title="Avisos"><AlertTriangle className="w-4 h-4" /></TabsTrigger>
                            <TabsTrigger value="evidencias" title="Evidencias"><FileSearch className="w-4 h-4" /></TabsTrigger>
                            <TabsTrigger value="notas" title="Notas"><BookOpen className="w-4 h-4" /></TabsTrigger>
                            <TabsTrigger value="progreso" title="Progreso"><ListTodo className="w-4 h-4" /></TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-4">
                        <TabsContent value="avisos" className="mt-0 space-y-4">
                            <AvisosTab warnings={vm.warnings} onReanalyze={onReanalyze} />
                        </TabsContent>

                        <TabsContent value="evidencias" className="mt-0 space-y-4">
                            <EvidenciasTab citations={vm.citations} />
                        </TabsContent>

                        <TabsContent value="notas" className="mt-0 flex flex-col h-full">
                            <NotasTab notas={vm.notas} onSaveNote={onSaveNote} />
                        </TabsContent>

                        <TabsContent value="progreso" className="mt-0">
                            <ProgresoTab />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </aside>
    );
}
