import { describe, it, expect, vi } from 'vitest';
import { toast } from 'sonner';
import { notify } from '../notify';

vi.mock('sonner', () => ({
    toast: Object.assign(vi.fn(), {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
    }),
}));

describe('notify', () => {
    it('routes success to toast.success with description', () => {
        notify.success('Guardado', 'Todo bien');
        expect(toast.success).toHaveBeenCalledWith('Guardado', { description: 'Todo bien' });
    });

    it('routes error to toast.error', () => {
        notify.error('Fallo');
        expect(toast.error).toHaveBeenCalledWith('Fallo', { description: undefined });
    });

    it('routes warning to toast.warning', () => {
        notify.warning('Ojo');
        expect(toast.warning).toHaveBeenCalledWith('Ojo', { description: undefined });
    });

    it('routes info to the base toast', () => {
        notify.info('Dato');
        expect(toast).toHaveBeenCalledWith('Dato', { description: undefined });
    });
});
