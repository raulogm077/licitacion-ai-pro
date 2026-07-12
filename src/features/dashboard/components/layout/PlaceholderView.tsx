import { LucideIcon } from 'lucide-react';

interface PlaceholderViewProps {
    icon: LucideIcon;
    title: string;
    description: string;
}

export function PlaceholderView({ icon: Icon, title, description }: PlaceholderViewProps) {
    return (
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
            <div className="p-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col items-center justify-center py-24 px-8 shadow-sm">
                    <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-brand-50 dark:bg-brand-950 mb-5">
                        <Icon className="w-7 h-7 text-brand-500" />
                    </div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2 text-center text-balance">
                        {title}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm leading-relaxed text-pretty">
                        {description}
                    </p>
                    <div className="mt-6 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-50 border border-brand-200 text-xs font-semibold text-brand-600 dark:bg-brand-950 dark:border-brand-800 dark:text-brand-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                            Módulo en construcción o contenido nativo a integrar
                        </span>
                    </div>
                </div>
            </div>
        </main>
    );
}
