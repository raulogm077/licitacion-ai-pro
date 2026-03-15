import { Note } from '../../../types';

interface NoteFormProps {
    newNote: {
        text: string;
        type: Note['type'];
        author: string;
    };
    setNewNote: React.Dispatch<React.SetStateAction<{
        text: string;
        type: Note['type'];
        author: string;
    }>>;
    handleAddNote: () => void;
}

export function NoteForm({ newNote, setNewNote, handleAddNote }: NoteFormProps) {
    return (
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
    );
}
