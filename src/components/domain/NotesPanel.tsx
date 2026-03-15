import { useState } from 'react';
import { Note } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { MessageSquare, Plus, X } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { NoteForm } from './notes/NoteForm';
import { NoteItem } from './notes/NoteItem';

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
                    <NoteForm
                        newNote={newNote}
                        setNewNote={setNewNote}
                        handleAddNote={handleAddNote}
                    />
                )}

                {/* Notes List */}
                {filteredNotes.length > 0 ? (
                    <div className="space-y-3">
                        {filteredNotes.sort((a, b) => b.timestamp - a.timestamp).map(note => (
                            <NoteItem
                                key={note.id}
                                note={note}
                                handleDeleteNote={handleDeleteNote}
                            />
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
