import React, { useState, useEffect } from 'react';
import { X, Tag as TagIcon, Plus } from 'lucide-react';
import { Badge } from '../ui/Badge';


interface TagManagerProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    suggestions?: string[];
}

export function TagManager({ tags, onChange, suggestions = [] }: TagManagerProps) {
    const [inputValue, setInputValue] = useState('');
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (inputValue.trim()) {
            const filtered = suggestions.filter(s =>
                s.toLowerCase().includes(inputValue.toLowerCase()) &&
                !tags.includes(s)
            );
            setFilteredSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
        } else {
            setShowSuggestions(false);
        }
    }, [inputValue, suggestions, tags]);

    const addTag = (tag: string) => {
        const trimmed = tag.trim();
        if (trimmed && !tags.includes(trimmed)) {
            onChange([...tags, trimmed]);
            setInputValue('');
            setShowSuggestions(false);
        }
    };

    const removeTag = (tagToRemove: string) => {
        onChange(tags.filter(t => t !== tagToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            addTag(inputValue);
        } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
        }
    };

    return (
        <div className="relative">
            <div className="flex flex-wrap gap-2 p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 min-h-[42px]">
                {tags.map((tag, idx) => (
                    <Badge
                        key={idx}
                        variant="default"
                        className="flex items-center gap-1 pr-1 bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                    >
                        <TagIcon size={12} />
                        {tag}
                        <button
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:bg-brand-200 dark:hover:bg-brand-800 rounded-full p-0.5 transition-colors"
                            type="button"
                        >
                            <X size={12} />
                        </button>
                    </Badge>
                ))}

                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => inputValue && setShowSuggestions(filteredSuggestions.length > 0)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder={tags.length === 0 ? "Añadir tags..." : ""}
                    className="flex-1 min-w-[120px] outline-none bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400"
                />
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredSuggestions.map((suggestion, idx) => (
                        <button
                            key={idx}
                            onClick={() => addTag(suggestion)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 text-sm"
                            type="button"
                        >
                            <Plus size={14} className="text-brand-500" />
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// End of component

