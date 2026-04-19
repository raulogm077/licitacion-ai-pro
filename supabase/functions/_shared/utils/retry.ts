export type RetryReason = 'rate_limit' | 'server_error' | 'network' | 'timeout' | 'unknown';

export interface RetryAttemptInfo {
    attempt: number;
    maxAttempts: number;
    waitMs: number;
    reason: RetryReason;
    label: string;
    error: unknown;
}

export interface RetryOptions {
    maxRetries: number;
    baseDelayMs: number;
    label: string;
    shouldRetry?: (err: unknown) => boolean;
    onRetry?: (info: RetryAttemptInfo) => void;
}

const RATE_LIMIT_FALLBACK_DELAYS_MS = [15_000, 30_000, 60_000, 120_000];

function readField(err: unknown, key: string): unknown {
    if (typeof err !== 'object' || err === null) return undefined;
    return (err as Record<string, unknown>)[key];
}

function readStatus(err: unknown): number | undefined {
    const status = readField(err, 'status');
    return typeof status === 'number' ? status : undefined;
}

function readCode(err: unknown): string | undefined {
    const code = readField(err, 'code');
    return typeof code === 'string' ? code : undefined;
}

function readMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    const message = readField(err, 'message');
    return typeof message === 'string' ? message : '';
}

function readHeaders(err: unknown): Headers | Record<string, string> | undefined {
    const headers = readField(err, 'headers');
    if (headers instanceof Headers) return headers;
    if (headers && typeof headers === 'object') return headers as Record<string, string>;

    const response = readField(err, 'response');
    if (!response || typeof response !== 'object') return undefined;
    const responseHeaders = (response as Record<string, unknown>).headers;
    if (responseHeaders instanceof Headers) return responseHeaders;
    if (responseHeaders && typeof responseHeaders === 'object') {
        return responseHeaders as Record<string, string>;
    }
    return undefined;
}

function readHeader(headers: Headers | Record<string, string> | undefined, key: string): string | null {
    if (!headers) return null;
    if (headers instanceof Headers) return headers.get(key);
    const exact = headers[key];
    if (typeof exact === 'string') return exact;
    const normalizedKey = key.toLowerCase();
    for (const [entryKey, value] of Object.entries(headers)) {
        if (entryKey.toLowerCase() === normalizedKey && typeof value === 'string') {
            return value;
        }
    }
    return null;
}

function parseRetryAfterMs(err: unknown): number | null {
    const headerValue = readHeader(readHeaders(err), 'retry-after');
    if (!headerValue) return null;

    const seconds = Number(headerValue);
    if (!Number.isNaN(seconds) && seconds > 0) {
        return seconds * 1000;
    }

    const targetAt = Date.parse(headerValue);
    if (Number.isNaN(targetAt)) return null;

    const delayMs = targetAt - Date.now();
    return delayMs > 0 ? delayMs : null;
}

export function getRetryReason(err: unknown): RetryReason {
    const message = readMessage(err).toLowerCase();
    const code = readCode(err);
    const status = readStatus(err);

    if (message.startsWith('timeout:')) return 'timeout';
    if (status === 429 || code === 'rate_limit_exceeded' || message.includes('rate limit')) return 'rate_limit';
    if (status !== undefined && status >= 500) return 'server_error';
    if (code === 'server_error') return 'server_error';
    if (message.includes('network') || message.includes('fetch') || message.includes('econn')) return 'network';
    return 'unknown';
}

export function getRetryDelayMs(err: unknown, attemptIndex: number, baseDelayMs: number): number {
    const retryReason = getRetryReason(err);
    if (retryReason === 'rate_limit') {
        const retryAfterMs = parseRetryAfterMs(err);
        if (retryAfterMs) return retryAfterMs;
        return RATE_LIMIT_FALLBACK_DELAYS_MS[Math.min(attemptIndex, RATE_LIMIT_FALLBACK_DELAYS_MS.length - 1)];
    }

    return baseDelayMs * Math.pow(2, attemptIndex);
}

/**
 * Retries an async operation with adaptive backoff.
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    { maxRetries, baseDelayMs, label, shouldRetry, onRetry }: RetryOptions
): Promise<T> {
    let lastError: unknown;
    const maxAttempts = maxRetries + 1;

    for (let attemptIndex = 0; attemptIndex <= maxRetries; attemptIndex++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attemptIndex < maxRetries) {
                if (shouldRetry && !shouldRetry(err)) {
                    console.warn(`[${label}] Attempt ${attemptIndex + 1} failed — not retrying (shouldRetry=false)`, err);
                    break;
                }

                const waitMs = getRetryDelayMs(err, attemptIndex, baseDelayMs);
                const reason = getRetryReason(err);
                const nextAttempt = attemptIndex + 2;

                onRetry?.({
                    attempt: nextAttempt,
                    maxAttempts,
                    waitMs,
                    reason,
                    label,
                    error: err,
                });

                console.warn(
                    `[${label}] Attempt ${attemptIndex + 1} failed — retrying attempt ${nextAttempt}/${maxAttempts} in ${waitMs}ms (${reason})`,
                    err
                );
                await new Promise((resolve) => setTimeout(resolve, waitMs));
            }
        }
    }

    throw lastError;
}

/** Returns true only for transient errors that are worth retrying (rate limits, network). */
export function isRetryableError(err: unknown): boolean {
    const message = readMessage(err);
    const status = readStatus(err);
    const code = readCode(err);

    if (message.startsWith('Timeout:')) return false;
    if (status === 429) return true;
    if (status !== undefined && status >= 500) return true;
    if (status !== undefined && status >= 400) return false;
    if (code === 'context_length_exceeded' || code === 'unsupported_model') return false;
    return true;
}
