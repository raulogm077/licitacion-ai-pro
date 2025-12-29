import { useEffect } from 'react';

/**
 * Hook for handling keyboard shortcuts
 * @param key - The key to listen for (e.g., 'Escape', 'Enter')
 * @param callback - Function to call when key is pressed
 * @param enabled - Whether the shortcut is active
 */
export function useKeyboardShortcut(
    key: string,
    callback: () => void,
    enabled: boolean = true
): void {
    useEffect(() => {
        if (!enabled) return;

        const handler = (e: KeyboardEvent) => {
            if (e.key === key) {
                e.preventDefault();
                callback();
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [key, callback, enabled]);
}
