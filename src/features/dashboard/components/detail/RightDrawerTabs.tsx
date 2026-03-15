import { useState } from 'react';
import { AlertTriangle, ListTodo, FileSearch, StickyNote } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { formatDate } from '../../../../lib/formatters';
import { PliegoVM } from '../../model/pliego-vm';

// Avisos Tab
interface AvisosTabProps {
    warnings: PliegoVM['warnings'];
    onReanalyze: () => void;
}

export function AvisosTab({ warnings, onReanalyze }: AvisosTabProps) {
    return (
        <>
            <div className="mb-4">
                <h4 className="font-semibold text-slate-900">Avisos del análisis</h4>
                <p className="text-xs text-slate-500">Ayudan a detectar información faltante.</p>
            </div>
            {warnings.map((w, i) => (
                <div key={i} className={`p-3 rounded-lg border text-sm ${w.severity === 'CRITICO' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-orange-50 border-orange-100 text-orange-800'
                    }`}>
                    <div className="flex gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{w.message}</span>
                    </div>
                </div>
            ))}
            {warnings.length === 0 && (
                <p className="text-sm text-slate-500 italic text-center py-8">No hay avisos relevantes.</p>
            )}

            <Button
                variant="outline"
                className="w-full mt-4 text-xs font-normal"
                onClick={onReanalyze}
            >
                Re-analizar Documento
            </Button>
        </>
    );
}

// Evidencias Tab
interface EvidenciasTabProps {
    citations: PliegoVM['citations'];
}

export function EvidenciasTab({ citations }: EvidenciasTabProps) {
    return (
        <>
            <div className="mb-2">
                <h4 className="font-semibold text-slate-900">Evidencias detectadas</h4>
                <p className="text-xs text-slate-500">Extractos literales del pliego.</p>
            </div>

            {citations.length === 0 ? (
                <div className="text-center py-10">
                    <FileSearch className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <h4 className="font-semibold text-slate-700">Sin evidencias</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">
                        No se han extraído citas textuales específicas.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {citations.map((c, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                            <p className="text-slate-600 italic">"{c.text}"</p>
                            <span className="text-xs text-slate-400 mt-1 block font-medium">{c.section}</span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

// Notas Tab
interface NotasTabProps {
    notas: PliegoVM['notas'];
    onSaveNote: (text: string) => void;
}

export function NotasTab({ notas, onSaveNote }: NotasTabProps) {
    const [noteText, setNoteText] = useState('');

    const handleSave = () => {
        if (!noteText.trim()) return;
        onSaveNote(noteText);
        setNoteText('');
    };

    return (
        <>
            <h4 className="font-semibold text-slate-900 mb-4">Notas</h4>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {(!notas || notas.length === 0) ? (
                    <div className="flex items-center justify-center h-40 text-sm text-slate-400 italic">
                        Todavía no hay notas.
                    </div>
                ) : (
                    notas.map((note, i) => (
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
        </>
    );
}

// Progreso Tab
export function ProgresoTab() {
    return (
        <>
            {/* Mocking generic progess if unknown structure */}
            <div className="text-center py-10">
                <ListTodo className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <h4 className="font-semibold text-slate-700">Sin pasos registrados</h4>
                <p className="text-xs text-slate-500 mt-1">
                    Este análisis no guardó trazas de ejecución detalladas.
                </p>
            </div>
        </>
    );
}
