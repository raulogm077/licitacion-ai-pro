import { useState } from 'react';
import { Note } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { MessageSquare, Plus, X, AlertCircle, HelpCircle, Info } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';

interface NotesPanelProps {
    notes: Note[];
    onChange: (notes: Note[]) => void;
    requirementIndex?: number; // If attached to specific requirement
}

export function NotesPanel({ notes, onChange, requirementIndex }: NotesPanelProps) {
    const { user } = useAuthStore();
    const [isAdding, setIsAdding] = useState(false);
    const [newNote, setNewNote] = useState({
        text: '',
        type: 'NOTE' as Note['type'],
        author: user?.email || 'Usuario'
    });

    const filteredNotes = requirementIndex !== undefined
        ? notes.filter(n => n.requirementIndex === requirementIndex)
        : notes;

    const handleAddNote = () => {
        if (!newNote.text.trim()) return;

        const note: Note = {
            id: crypto.randomUUID(),
            text: newNote.text,
            author: newNote.author,
            timestamp: Date.now(),
            type: newNote.type,
            requirementIndex,
        };

        onChange([...notes, note]);
        setNewNote({ text: '', type: 'NOTE', author: user?.email || 'Usuario' });
        setIsAdding(false);
    };

    const handleDeleteNote = (noteId: string) => {
        onChange(notes.filter(n => n.id !== noteId));
    };

    const formatDate = (timestamp: number) => {
        return new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(timestamp));
    };

    const getTypeIcon = (type: Note['type']) => {
        switch (type) {
            case 'QUESTION':
                return <HelpCircle size={16} className="text-blue-500" />;
            case 'WARNING':
                return <AlertCircle size={16} className="text-orange-500" />;
            default:
                return <Info size={16} className="text-brand-500" />;
        }
    };

    const getTypeBadge = (type: Note['type']) => {
        const variants = {
            NOTE: 'default' as const,
            QUESTION: 'default' as const,
            WARNING: 'warning' as const,
        };
        return variants[type];
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare size={18} className="text-brand-600" />
                        Notas y Comentarios
                        {filteredNotes.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                                {filteredNotes.length}
                            </Badge>
                        )}
                    </CardTitle>
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
                    >
                        {isAdding ? <X size={14} /> : <Plus size={14} />}
                        {isAdding ? 'Cancelar' : 'Añadir'}
                    </button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Add Note Form */}
                {isAdding && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Tipo
                            </label>
                            <div className="flex gap-2">
                                {(['NOTE', 'QUESTION', 'WARNING'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setNewNote(prev => ({ ...prev, type }))}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${newNote.type === type
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:border-brand-500'
                                            }`}
                                    >
                                        {type === 'NOTE' && 'Nota'}
                                        {type === 'QUESTION' && 'Pregunta'}
                                        {type === 'WARNING' && 'Advertencia'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Comentario
                            </label>
                            <textarea
                                value={newNote.text}
                                onChange={(e) => setNewNote(prev => ({ ...prev, text: e.target.value }))}
                                placeholder="Escribe tu nota o comentario..."
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-700 dark:text-white resize-none"
                            />
                        </div>

                        <button
                            onClick={handleAddNote}
                            disabled={!newNote.text.trim()}
                            className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                        >
                            Guardar Nota
                        </button>
                    </div>
                )}

                {/* Notes List */}
                {filteredNotes.length > 0 ? (
                    <div className="space-y-3">
                        {filteredNotes.sort((a, b) => b.timestamp - a.timestamp).map(note => (
                            <div
                                key={note.id}
                                className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-sm transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {getTypeIcon(note.type)}
                                        <Badge variant={getTypeBadge(note.type)} className="text-xs">
                                            {note.type}
                                        </Badge>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            por {note.author}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400">
                                            {formatDate(note.timestamp)}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteNote(note.id)}
                                            className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                    {note.text}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay notas todavía</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
