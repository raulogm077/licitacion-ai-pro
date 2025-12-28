import React from 'react';
import { promptRegistry } from '../../config/prompt-registry';
import { Settings, Check, Sparkles } from 'lucide-react';

export const PluginSelector: React.FC = () => {
    const plugins = promptRegistry.listPlugins();
    const activePlugin = promptRegistry.getActivePlugin();
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    const handleSelect = (id: string) => {
        promptRegistry.setActivePlugin(id);
        forceUpdate();
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <Settings size={18} className="text-slate-500" />
                <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">Motor de Análisis (AI)</h3>
            </div>
            <div className="p-2 space-y-1">
                {plugins.map((plugin) => (
                    <button
                        key={plugin.id}
                        onClick={() => handleSelect(plugin.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-all group ${activePlugin.id === plugin.id
                                ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 ring-1 ring-brand-200 dark:ring-brand-800'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-400'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-md ${activePlugin.id === plugin.id ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-slate-500'
                                }`}>
                                <Sparkles size={16} />
                            </div>
                            <div>
                                <p className="text-sm font-medium">{plugin.name}</p>
                                <p className="text-xs opacity-60 line-clamp-1">{plugin.description}</p>
                            </div>
                        </div>
                        {activePlugin.id === plugin.id && <Check size={16} className="text-brand-600" />}
                    </button>
                ))}
            </div>
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700">
                <p className="text-[10px] text-slate-400 font-mono text-center uppercase tracking-wider">
                    v{activePlugin.version} • Registry Mode: Active
                </p>
            </div>
        </div>
    );
};
