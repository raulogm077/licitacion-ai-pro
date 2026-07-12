import { getRetryDelayMs, getRetryReason, isRetryableError, retryWithBackoff } from './retry.ts';
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test('getRetryDelayMs honors Retry-After headers for rate limits', () => {
    const err = {
        status: 429,
        headers: new Headers({ 'retry-after': '7' }),
    };

    const delay = getRetryDelayMs(err, 0, 500);
    if (delay !== 7000) {
        throw new Error(`Expected delay to honor Retry-After header, got ${delay}`);
    }
});

Deno.test('getRetryDelayMs uses aggressive fallback schedule for rate limits', () => {
    const err = {
        status: 429,
        message: 'Rate limit exceeded',
    };

    const firstDelay = getRetryDelayMs(err, 0, 500);
    const thirdDelay = getRetryDelayMs(err, 2, 500);

    if (firstDelay !== 15000) {
        throw new Error(`Expected first rate-limit delay to be 15000ms, got ${firstDelay}`);
    }

    if (thirdDelay !== 60000) {
        throw new Error(`Expected third rate-limit delay to be 60000ms, got ${thirdDelay}`);
    }
});

Deno.test('retry helpers classify non-retryable timeouts correctly', () => {
    const err = new Error('Timeout: Block datosGenerales');

    if (isRetryableError(err)) {
        throw new Error('Timeout errors must not be retried');
    }

    if (getRetryReason(err) !== 'timeout') {
        throw new Error(`Expected timeout retry reason, got ${getRetryReason(err)}`);
    }
});

Deno.test('retryWithBackoff caps the wait via maxDelayMs (no unbounded Retry-After)', async () => {
    let waited = -1;
    let attempts = 0;
    const err = { status: 429, headers: new Headers({ 'retry-after': '600' }) }; // 600s
    // Small cap keeps the test fast while still exercising the clamp.
    const cap = 20;

    await retryWithBackoff(
        () => {
            attempts++;
            if (attempts === 1) throw err;
            return Promise.resolve('ok');
        },
        {
            maxRetries: 1,
            baseDelayMs: 1000,
            maxDelayMs: cap,
            label: 'test',
            onRetry: (info) => {
                waited = info.waitMs;
            },
        }
    );

    assertEquals(attempts, 2);
    // 600s Retry-After must be clamped to the configured cap.
    assertEquals(waited, cap);
});

Deno.test('retryWithBackoff respects shouldRetry=false (no retry)', async () => {
    let attempts = 0;
    let threw = false;
    try {
        await retryWithBackoff(
            () => {
                attempts++;
                throw new Error('Timeout: Block x');
            },
            {
                maxRetries: 1,
                baseDelayMs: 1,
                label: 'test',
                shouldRetry: isRetryableError,
            }
        );
    } catch {
        threw = true;
    }
    assertEquals(attempts, 1);
    assertEquals(threw, true);
});
