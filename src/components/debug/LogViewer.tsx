
import React, { useState } from 'react';
import { useLoggerStore, LogLevel } from '../../services/logger';
import { ChevronDown, Trash2, Terminal } from 'lucide-react';

export const LogViewer: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const logs = useLoggerStore((state) => state.logs);
    const clearLogs = useLoggerStore((state) => state.clearLogs);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-slate-900 text-slate-100 p-2 rounded-full shadow-lg border border-slate-700 hover:bg-slate-800 transition-colors z-50"
                title="Abrir Consola de Logs"
            >
                <Terminal size={20} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-0 right-0 w-full md:w-[600px] h-[400px] bg-slate-950 text-slate-300 border-t md:border-l border-slate-700 shadow-2xl flex flex-col z-50 animate-in slide-in-from-bottom font-mono text-xs">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-brand-500" />
                    <span className="font-semibold text-slate-100">Debug Console</span>
                    <span className="px-2 py-0.5 bg-slate-800 rounded-full text-[10px]">{logs.length} logs</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={clearLogs} className="p-1 hover:text-red-400 transition-colors" title="Limpiar">
                        <Trash2 size={14} />
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-1 hover:text-white transition-colors" title="Cerrar">
                        <ChevronDown size={14} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {logs.length === 0 && (
                    <div className="text-center text-slate-600 mt-10 italic">
                        No hay logs registrados.
                    </div>
                )}
                {logs.map((log) => (
                    <div key={log.id} className="border-b border-slate-800 pb-2 last:border-0">
                        <div className="flex items-start gap-2">
                            <span className={`
                                px-1.5 rounded text-[10px] font-bold uppercase shrink-0 mt-0.5
                                ${log.level === LogLevel.ERROR ? 'bg-red-900 text-red-200' :
                                    log.level === LogLevel.WARN ? 'bg-orange-900 text-orange-200' :
                                        log.level === LogLevel.INFO ? 'bg-blue-900 text-blue-200' :
                                            'bg-slate-800 text-slate-400'}
                            `}>
                                {log.level}
                            </span>
                            <span className="text-slate-500 text-[10px] shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`break-all ${log.level === LogLevel.ERROR ? 'text-red-300' : 'text-slate-300'}`}>
                                {log.message}
                            </span>
                        </div>
                        {log.data && (
                            <pre className="mt-1 ml-14 bg-slate-900 p-2 rounded overflow-x-auto text-[10px] text-slate-400 border border-slate-800">
                                {JSON.stringify(log.data, null, 2) as string}
                            </pre>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
