
import { useState } from 'react';
import { PliegoVM } from '../../model/pliego-vm';
import { Button } from '../../../../components/ui/Button';
import { X, Pin, AlertTriangle, BookOpen, ListTodo, FileSearch, StickyNote } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../components/ui/Tabs';
import { formatDate } from '../../../../lib/formatters';

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
    const [noteText, setNoteText] = useState('');

    if (!isOpen && !isPinned) return null;

    const handleSave = () => {
        if (!noteText.trim()) return;
        onSaveNote(noteText);
        setNoteText('');
    };

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
                            <div className="mb-4">
                                <h4 className="font-semibold text-slate-900">Avisos del análisis</h4>
                                <p className="text-xs text-slate-500">Ayudan a detectar información faltante.</p>
                            </div>
                            {vm.warnings.map((w, i) => (
                                <div key={i} className={`p-3 rounded-lg border text-sm ${w.severity === 'CRITICO' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-orange-50 border-orange-100 text-orange-800'
                                    }`}>
                                    <div className="flex gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{w.message}</span>
                                    </div>
                                </div>
                            ))}
                            {vm.warnings.length === 0 && (
                                <p className="text-sm text-slate-500 italic text-center py-8">No hay avisos relevantes.</p>
                            )}

                            <Button
                                variant="outline"
                                className="w-full mt-4 text-xs font-normal"
                                onClick={onReanalyze}
                            >
                                Re-analizar Documento
                            </Button>
                        </TabsContent>

                        <TabsContent value="evidencias" className="mt-0 space-y-4">
                            <div className="mb-2">
                                <h4 className="font-semibold text-slate-900">Evidencias detectadas</h4>
                                <p className="text-xs text-slate-500">Extractos literales del pliego.</p>
                            </div>

                            {vm.citations.length === 0 ? (
                                <div className="text-center py-10">
                                    <FileSearch className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                    <h4 className="font-semibold text-slate-700">Sin evidencias</h4>
                                    <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">
                                        No se han extraído citas textuales específicas.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {vm.citations.map((c, i) => (
                                        <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                                            <p className="text-slate-600 italic">"{c.text}"</p>
                                            <span className="text-xs text-slate-400 mt-1 block font-medium">{c.section}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="notas" className="mt-0 flex flex-col h-full">
                            <h4 className="font-semibold text-slate-900 mb-4">Notas</h4>

                            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                                {(!vm.notas || vm.notas.length === 0) ? (
                                    <div className="flex items-center justify-center h-40 text-sm text-slate-400 italic">
                                        Todavía no hay notas.
                                    </div>
                                ) : (
                                    vm.notas.map((note, i) => (
                                        <div key={i} className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 relative group">
                                            <p className="text-sm text-slate-800 whitespace-pre-wrap">{note.text}</p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-slate-400">{formatDate(note.timestamp)}</span>
                                                <StickyNote className="w-3 h-3 text-yellow-400" />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="mt-auto pt-4 border-t border-slate-100">
                                <textarea
                                    className="w-full text-sm p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
                                    rows={3}
                                    placeholder="Escribe una nota sobre esta licitación..."
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                ></textarea>
                                <Button
                                    className="w-full mt-2"
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={!noteText.trim()}
                                >
                                    Guardar nota
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="progreso" className="mt-0">
                            {/* Mocking generic progess if unknown structure */}
                            <div className="text-center py-10">
                                <ListTodo className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                <h4 className="font-semibold text-slate-700">Sin pasos registrados</h4>
                                <p className="text-xs text-slate-500 mt-1">
                                    Este análisis no guardó trazas de ejecución detalladas.
                                </p>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </aside>
    );
}
