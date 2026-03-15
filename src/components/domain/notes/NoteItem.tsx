import { Note } from '../../../types';
import { Badge } from '../../ui/Badge';
import { AlertCircle, HelpCircle, Info, X } from 'lucide-react';

interface NoteItemProps {
    note: Note;
    handleDeleteNote: (noteId: string) => void;
}

export function NoteItem({ note, handleDeleteNote }: NoteItemProps) {
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
        <div
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
    );
}
