import { useState } from 'react';
import { Eye } from 'lucide-react';

interface Evidence {
    quote: string;
    pageHint?: string;
}

interface EvidenceToggleProps {
    evidence?: Evidence;
    className?: string;
}

export function EvidenceToggle({ evidence, className = '' }: EvidenceToggleProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!evidence) return null;

    return (
        <div className={`relative inline-flex items-center ${className}`}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-full hover:bg-indigo-50"
                title="Ver evidencia en el documento"
            >
                <Eye size={16} />
            </button>

            {isOpen && (
                <div
                    className="absolute left-0 top-full mt-2 w-64 md:w-80 bg-white border border-slate-200 shadow-xl rounded-lg p-3 z-50 text-xs text-slate-600 select-text cursor-auto text-left"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="font-semibold text-slate-800 mb-1 flex justify-between items-center">
                        <span>Evidencia:</span>
                        {evidence.pageHint && (
                            <span className="text-[10px] uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                                Pág. {evidence.pageHint}
                            </span>
                        )}
                    </div>
                    <div className="italic bg-slate-50 p-2.5 rounded border border-slate-100 text-slate-700 leading-relaxed max-h-48 overflow-y-auto">
                        "{evidence.quote}"
                    </div>

                    {/* Backdrop to close when clicking outside (or use a global listener, but this is simple) */}
                    <div
                        className="fixed inset-0 z-[-1]"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />
                </div>
            )}
        </div>
    );
}
