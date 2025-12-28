import { AnalysisVersion } from '../../../lib/schemas';
import { History, Clock, CheckCircle2, RotateCcw } from 'lucide-react';
// If util doesn't exist, I will use standard string template. 
// I'll check dashboard files later. For now standard.

interface VersionSelectorProps {
    versions: AnalysisVersion[];
    currentVersionId: number;
    onSelectVersion: (versionId: number) => void;
}

export function VersionSelector({ versions, currentVersionId, onSelectVersion }: VersionSelectorProps) {
    // Sort versions descending (newest first)
    const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

    return (
        <div className="space-y-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                <History size={14} />
                Historial de Versiones
            </h4>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {sortedVersions.map((v) => {
                    const isSelected = v.version === currentVersionId;
                    const date = new Date(v.created_at);

                    return (
                        <button
                            key={v.version}
                            onClick={() => onSelectVersion(v.version)}
                            className={`w-full text-left p-3 rounded-lg border transition-all text-sm group relative ${isSelected
                                ? 'bg-brand-50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-800'
                                : 'bg-white border-slate-100 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`font-semibold ${isSelected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                    Versión {v.version}
                                </span>
                                {isSelected && (
                                    <span className="bg-brand-100 text-brand-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                                        ACTUAL
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                                <Clock size={12} />
                                {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                                <span className={`flex items-center gap-1 ${v.status === 'succeeded' ? 'text-green-600' : 'text-slate-500'
                                    }`}>
                                    {v.status === 'succeeded' ? <CheckCircle2 size={12} /> : <RotateCcw size={12} />}
                                    {v.status === 'succeeded' ? 'Completado' : v.status}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
