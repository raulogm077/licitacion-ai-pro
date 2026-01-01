import React from 'react';
import { llmFactory } from '../../llm/llmFactory';
import { ChevronDown, Check, AlertCircle } from 'lucide-react';

interface ProviderSelectorProps {
    value: string;
    onChange: (provider: string) => void;
    disabled?: boolean;
    variant?: 'default' | 'minimal';
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({ value, onChange, disabled = false, variant = 'default' }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [providers, setProviders] = React.useState<string[]>([]);

    React.useEffect(() => {
        // Load available providers and ensure uniqueness
        const availableProviders = Array.from(new Set(llmFactory.listProviders()));

        // FAILSAFE: Force 'openai' if missing (user request)
        if (!availableProviders.includes('openai')) {
            availableProviders.push('openai');
        }

        setProviders(availableProviders);
    }, []);

    const handleSelect = (provider: string) => {
        onChange(provider);
        setIsOpen(false);
    };

    const getProviderMetadata = (providerName: string) => {
        return llmFactory.getMetadata(providerName);
    };

    const isProviderAvailable = (providerName: string) => {
        return llmFactory.isProviderAvailable(providerName);
    };

    const selectedMetadata = getProviderMetadata(value);

    // Minimal Variant (Badge Style)
    if (variant === 'minimal') {
        return (
            <div className="relative inline-block text-left">
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`
                        inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                        text-xs font-medium transition-all duration-200
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/10'}
                        ${isOpen ? 'bg-black/5 dark:bg-white/10' : ''}
                        text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700
                    `}
                >
                    <span className="opacity-70">Powered by</span>
                    <span className="font-semibold text-brand-600 dark:text-brand-400">
                        {selectedMetadata?.displayName || value}
                    </span>
                    <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && !disabled && (
                    <div className="absolute right-0 mt-2 w-56 origin-top-right bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-in fade-in zoom-in-95 duration-100">
                        <div className="py-1">
                            {providers.map((providerName) => {
                                const metadata = getProviderMetadata(providerName);
                                const available = isProviderAvailable(providerName);
                                const isSelected = providerName === value;

                                return (
                                    <button
                                        key={providerName}
                                        onClick={() => handleSelect(providerName)}
                                        className={`
                                            group flex items-center w-full px-4 py-2 text-sm
                                            ${isSelected ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'}
                                            ${!available ? 'opacity-50' : ''}
                                        `}
                                    >
                                        <div className="flex-1 flex flex-col items-start">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{metadata?.displayName || providerName}</span>
                                                {isSelected && <Check size={14} />}
                                            </div>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                {metadata?.description}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {isOpen && (
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                )}
            </div>
        );
    }

    // Default Variant (Full Input)
    return (
        <div className="relative w-full max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Proveedor de IA
            </label>

            {/* Dropdown Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between px-4 py-3 
                    bg-white border border-gray-300 rounded-lg shadow-sm
                    hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    transition-all duration-200
                `}
            >
                <div className="flex items-center space-x-3">
                    {isProviderAvailable(value) ? (
                        <Check className="w-5 h-5 text-green-500" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                    )}
                    <div className="text-left">
                        <div className="font-medium text-gray-900">
                            {selectedMetadata?.displayName || value}
                        </div>
                        <div className="text-xs text-gray-500">
                            {selectedMetadata?.description}
                        </div>
                    </div>
                </div>
                <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && !disabled && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
                    {providers.map((providerName) => {
                        const metadata = getProviderMetadata(providerName);
                        const available = isProviderAvailable(providerName);
                        const isSelected = providerName === value;

                        return (
                            <button
                                key={providerName}
                                type="button"
                                onClick={() => handleSelect(providerName)}
                                className={`
                                    w-full text-left px-4 py-3 flex items-start space-x-3
                                    hover:bg-gray-50 transition-colors
                                    ${isSelected ? 'bg-brand-50' : ''}
                                    ${!available ? 'opacity-60' : ''}
                                    first:rounded-t-lg last:rounded-b-lg
                                `}
                            >
                                {available ? (
                                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                                )}

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2">
                                        <span className="font-medium text-gray-900">
                                            {metadata?.displayName || providerName}
                                        </span>
                                        {metadata?.supportsStreaming && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                🔄 Streaming
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {metadata?.description}
                                    </p>
                                    {!available && (
                                        <p className="text-xs text-amber-600 mt-1">
                                            ⚠️ API key no configurada
                                        </p>
                                    )}
                                </div>

                                {isSelected && (
                                    <Check className="w-5 h-5 text-brand-600 mt-0.5 flex-shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Click outside to close */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-0"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};
