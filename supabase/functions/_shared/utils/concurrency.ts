/**
 * Runs task thunks with a fixed worker-pool concurrency, preserving input
 * order in the results. A rejected task propagates and aborts the pool.
 */
export async function runWithConcurrency<T>(items: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
    const results: T[] = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
        while (nextIndex < items.length) {
            const idx = nextIndex++;
            results[idx] = await items[idx]();
        }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
}
