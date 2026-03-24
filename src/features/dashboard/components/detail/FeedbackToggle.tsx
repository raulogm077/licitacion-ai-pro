import { useState, useCallback } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { feedbackService } from '../../../../services/feedback.service';
import { logger } from '../../../../services/logger';

interface FeedbackToggleProps {
    fieldPath: string;
    value: string;
    licitacionHash?: string;
    className?: string;
}

export function FeedbackToggle({ fieldPath, value, licitacionHash, className = '' }: FeedbackToggleProps) {
    const [status, setStatus] = useState<'idle' | 'up' | 'down'>('idle');

    const handleFeedback = useCallback(
        async (type: 'up' | 'down') => {
            const newStatus = status === type ? 'idle' : type;
            setStatus(newStatus);

            if (newStatus === 'idle') {
                if (licitacionHash) {
                    feedbackService.removeFeedback(licitacionHash, fieldPath).catch(() => {});
                }
                return;
            }

            logger.info(`Feedback for ${fieldPath}: ${type === 'up' ? 'Correcto' : 'Incorrecto'}. Value: ${value}`);

            if (licitacionHash) {
                const result = await feedbackService.saveFeedback(licitacionHash, fieldPath, value, newStatus);
                if (!result.ok) {
                    logger.warn(`Failed to save feedback: ${result.error.message}`);
                }
            }
        },
        [status, fieldPath, value, licitacionHash]
    );

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
                    status === 'down' ? 'bg-red-100 text-red-700' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                }`}
                title="Dato incorrecto"
                aria-label="Marcar como incorrecto"
            >
                <ThumbsDown size={14} className={status === 'down' ? 'fill-red-600' : ''} />
            </button>
        </div>
    );
}
