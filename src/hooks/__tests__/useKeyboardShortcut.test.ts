import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useKeyboardShortcut } from '../useKeyboardShortcut';

describe('useKeyboardShortcut', () => {
    it('calls callback when matching key is pressed', () => {
        const callback = vi.fn();
        renderHook(() => useKeyboardShortcut('Escape', callback, true));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        expect(callback).toHaveBeenCalledOnce();
    });

    it('does not call callback for non-matching key', () => {
        const callback = vi.fn();
        renderHook(() => useKeyboardShortcut('Escape', callback, true));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

        expect(callback).not.toHaveBeenCalled();
    });

    it('does not call callback when disabled', () => {
        const callback = vi.fn();
        renderHook(() => useKeyboardShortcut('Escape', callback, false));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        expect(callback).not.toHaveBeenCalled();
    });

    it('cleans up listener on unmount', () => {
        const callback = vi.fn();
        const { unmount } = renderHook(() => useKeyboardShortcut('Escape', callback, true));

        unmount();

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(callback).not.toHaveBeenCalled();
    });

    it('defaults to enabled when not specified', () => {
        const callback = vi.fn();
        renderHook(() => useKeyboardShortcut('Enter', callback));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(callback).toHaveBeenCalledOnce();
    });
});
