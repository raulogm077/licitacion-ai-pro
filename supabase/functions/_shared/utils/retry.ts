/**
 * Retries an async operation with exponential backoff.
 *
 * @param fn           - The async operation to attempt.
 * @param maxRetries   - Maximum number of additional attempts after the first (e.g. 2 = up to 3 total tries).
 * @param baseDelayMs  - Initial delay in ms; doubles on each subsequent retry.
 * @param label        - Identifier used in log messages for traceability.
 * @returns The resolved value of `fn` on the first successful attempt.
 * @throws The last error encountered after all retries are exhausted.
 *
 * @example
 * const result = await retryWithBackoff(() => callOpenAI(), 2, 500, 'BlockExtraction');
 * // Attempts: immediately → 500ms later → 1000ms later
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    baseDelayMs: number,
    label: string
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                const delayMs = baseDelayMs * Math.pow(2, attempt);
                console.warn(`[${label}] Attempt ${attempt + 1} failed — retrying in ${delayMs}ms`, err);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }

    throw lastError;
}
