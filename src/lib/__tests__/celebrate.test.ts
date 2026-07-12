import { describe, it, expect, vi, beforeEach } from 'vitest';

const confettiMock = vi.fn();
vi.mock('canvas-confetti', () => ({ default: confettiMock }));

import { celebrateAnalysisComplete } from '../celebrate';

describe('celebrateAnalysisComplete', () => {
    beforeEach(() => {
        confettiMock.mockClear();
        vi.useFakeTimers();
    });

    it('fires brand confetti when motion is allowed', async () => {
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));

        await celebrateAnalysisComplete();
        expect(confettiMock).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(300);
        expect(confettiMock).toHaveBeenCalledTimes(3);

        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('is a no-op under prefers-reduced-motion', async () => {
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));

        await celebrateAnalysisComplete();
        expect(confettiMock).not.toHaveBeenCalled();

        vi.unstubAllGlobals();
        vi.useRealTimers();
    });
});
