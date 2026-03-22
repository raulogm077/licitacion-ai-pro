import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { logger } from '../../../../services/logger';

interface FeedbackToggleProps {
    fieldPath: string;
    value: string;
    className?: string;
}

export function FeedbackToggle({ fieldPath, value, className = '' }: FeedbackToggleProps) {
    const [status, setStatus] = useState<'idle' | 'up' | 'down'>('idle');

    const handleFeedback = (type: 'up' | 'down') => {
        // Toggle behavior
        if (status === type) {
            setStatus('idle');
            return;
        }

        setStatus(type);

        // Simulating sending feedback to backend
        logger.info(`Feedback for ${fieldPath}: ${type === 'up' ? 'Correcto' : 'Incorrecto'}. Value: ${value}`);
    };

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleFeedback('up');
                }}
                className={`p-1 rounded-md transition-colors ${
                    status === 'up'
                        ? 'bg-green-100 text-green-700'
                        : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                }`}
                title="Dato correcto"
                aria-label="Marcar como correcto"
            >
                <ThumbsUp size={14} className={status === 'up' ? 'fill-green-600' : ''} />
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleFeedback('down');
                }}
                className={`p-1 rounded-md transition-colors ${
                    status === 'down'
                        ? 'bg-red-100 text-red-700'
                        : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                }`}
                title="Dato incorrecto"
                aria-label="Marcar como incorrecto"
            >
                <ThumbsDown size={14} className={status === 'down' ? 'fill-red-600' : ''} />
            </button>
        </div>
    );
}
