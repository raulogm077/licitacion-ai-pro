/**
 * Retries an async operation with exponential backoff.
 *
 * @param fn           - The async operation to attempt.
 * @param maxRetries   - Maximum number of additional attempts after the first (e.g. 2 = up to 3 total tries).
 * @param baseDelayMs  - Initial delay in ms; doubles on each subsequent retry.
 * @param label        - Identifier used in log messages for traceability.
 * @param shouldRetry  - Optional predicate. Return false to suppress retry for specific errors
 *                       (e.g. timeouts — retrying after a 90s timeout wastes another 90s of pipeline budget).
 *                       Defaults to always retry.
 * @returns The resolved value of `fn` on the first successful attempt.
 * @throws The last error encountered after all retries are exhausted.
 *
 * @example
 * const result = await retryWithBackoff(
 *   () => callOpenAI(), 2, 500, 'BlockExtraction',
 *   (err) => !(err instanceof Error && err.message.startsWith('Timeout:'))
 * );
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    baseDelayMs: number,
    label: string,
    shouldRetry?: (err: unknown) => boolean
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                // Skip retry if caller explicitly opts out (e.g. timeout errors)
                if (shouldRetry && !shouldRetry(err)) {
                    console.warn(`[${label}] Attempt ${attempt + 1} failed — not retrying (shouldRetry=false)`, err);
                    break;
                }
                const delayMs = baseDelayMs * Math.pow(2, attempt);
                console.warn(`[${label}] Attempt ${attempt + 1} failed — retrying in ${delayMs}ms`, err);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }

    throw lastError;
}

/** Returns true only for transient errors that are worth retrying (rate limits, network). */
export function isRetryableError(err: unknown): boolean {
    if (!(err instanceof Error)) return true;
    // Never retry timeouts — a second attempt after a 90s timeout burns another 90s of pipeline budget
    if (err.message.startsWith('Timeout:')) return false;
    return true;
}
