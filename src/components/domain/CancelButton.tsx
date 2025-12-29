import React from 'react';
import { X, Loader2 } from 'lucide-react';

interface CancelButtonProps {
    onClick: () => void;
    loading?: boolean;
}

export const CancelButton: React.FC<CancelButtonProps> = ({ onClick, loading = false }) => {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={loading}
            className={`
                inline-flex items-center justify-center px-6 py-3
                border-2 border-red-500 text-red-600
                bg-white rounded-lg font-medium
                hover:bg-red-50 hover:border-red-600
                focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
                ${!loading ? 'animate-pulse' : ''}
                shadow-sm hover:shadow-md
            `}
            aria-label="Cancelar análisis"
        >
            {loading ? (
                <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Cancelando...
                </>
            ) : (
                <>
                    <X className="w-5 h-5 mr-2" />
                    Cancelar Análisis
                </>
            )}
        </button>
    );
};
