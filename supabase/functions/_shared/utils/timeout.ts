/**
 * Wraps a promise with a timeout. Rejects if the promise doesn't resolve in time.
 * Used to prevent hung API calls from blocking the pipeline indefinitely.
 */
export async function callWithTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout: ${label} excedió ${timeoutMs / 1000}s`)), timeoutMs);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer!);
    }
}
