import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Code, Copy, Check } from 'lucide-react';
import { LicitacionData } from '../../../types';

interface JsonViewerProps {
    data: LicitacionData;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2">
                    <Code size={20} className="text-slate-500 dark:text-slate-400" />
                    Datos Estructurados (JSON)
                </CardTitle>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 bg-brand-50 dark:bg-brand-900/30 px-2.5 py-1.5 rounded-md transition-colors"
                >
                    {copied ? (
                        <>
                            <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                            Copiado
                        </>
                    ) : (
                        <>
                            <Copy size={14} />
                            Copiar JSON
                        </>
                    )}
                </button>
            </CardHeader>
            <CardContent>
                <div className="relative group">
                    <div className="bg-slate-950 text-slate-300 p-5 rounded-xl overflow-x-auto font-mono text-xs sm:text-sm max-h-[400px] overflow-y-auto border border-slate-800 shadow-xl scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                        <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
                    </div>
                    <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-white/10 inset-px" />
                </div>
            </CardContent>
        </Card>
    );
};
