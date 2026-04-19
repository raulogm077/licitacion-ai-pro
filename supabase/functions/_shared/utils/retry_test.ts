import { getRetryDelayMs, getRetryReason, isRetryableError } from './retry.ts';

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
