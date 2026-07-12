/**
 * Cleanup de recursos OpenAI
 *
 * Estrategia TTL: Los recursos (vector stores, files) se marcan para
 * limpieza con un timestamp futuro. Esta función limpia los que han expirado.
 */
import OpenAI from 'npm:openai@6.33.0';

/** Default TTL: 24 hours after job completion */
export const DEFAULT_CLEANUP_TTL_HOURS = 24;

export function getCleanupTimestamp(ttlHours: number = DEFAULT_CLEANUP_TTL_HOURS): string {
    const date = new Date();
    date.setHours(date.getHours() + ttlHours);
    return date.toISOString();
}

/** A 404 means the resource is already gone — that counts as cleaned. */
function isAlreadyDeleted(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { status?: number }).status === 404;
}

/**
 * Cleanup a specific job's OpenAI resources.
 * Called when TTL expires or on-demand.
 *
 * @returns true when every resource was deleted (or no longer exists), so the
 * caller can safely drop its references; false keeps them for a future retry.
 */
export async function cleanupJobResources(
    openai: OpenAI,
    vectorStoreId?: string | null,
    fileIds?: string[] | null
): Promise<boolean> {
    console.log('[Cleanup] Starting resource cleanup...');

    let allSucceeded = true;
    const tasks: Promise<void>[] = [];

    if (vectorStoreId) {
        tasks.push(
            openai.vectorStores
                .delete(vectorStoreId)
                .then(() => console.log(`[Cleanup] Vector Store deleted: ${vectorStoreId}`))
                .catch((error) => {
                    if (isAlreadyDeleted(error)) return;
                    allSucceeded = false;
                    console.error(`[Cleanup] Failed to delete vector store ${vectorStoreId}:`, error);
                })
        );
    }

    if (fileIds && fileIds.length > 0) {
        tasks.push(
            Promise.allSettled(fileIds.map((fileId) => openai.files.delete(fileId))).then((results) => {
                for (let i = 0; i < results.length; i++) {
                    const result = results[i];
                    if (result.status === 'fulfilled') {
                        console.log(`[Cleanup] File deleted: ${fileIds[i]}`);
                    } else if (!isAlreadyDeleted(result.reason)) {
                        allSucceeded = false;
                        console.error(`[Cleanup] Failed to delete file ${fileIds[i]}:`, result.reason);
                    }
                }
            })
        );
    }

    await Promise.all(tasks);
    return allSucceeded;
}

/**
 * Opportunistic cleanup: run at the start of new analysis requests.
 * Checks for expired jobs and cleans their resources.
 * Throttled to run at most once every CLEANUP_INTERVAL_MS to avoid
 * excessive DB queries under concurrent load.
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let lastCleanupRun = 0;

export async function runOpportunisticCleanup<T extends { vector_store_id?: string; file_ids?: string[] }>(
    openai: OpenAI,
    getExpiredJobs: () => Promise<T[]>,
    onJobCleaned?: (job: T) => Promise<void>
): Promise<number> {
    const now = Date.now();
    if (now - lastCleanupRun < CLEANUP_INTERVAL_MS) {
        return 0; // Throttled — skip this run
    }
    lastCleanupRun = now;

    try {
        const expiredJobs = await getExpiredJobs();
        let cleaned = 0;

        for (const job of expiredJobs) {
            // Delete in OpenAI FIRST; only then let the caller drop its DB
            // references. The reverse order orphaned vector stores/files
            // forever when the OpenAI deletion failed (the IDs were already
            // nulled in the DB, so no future run could retry them).
            const succeeded = await cleanupJobResources(openai, job.vector_store_id, job.file_ids);
            if (succeeded) {
                await onJobCleaned?.(job);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[Cleanup] Cleaned ${cleaned} expired jobs`);
        }
        return cleaned;
    } catch (error) {
        console.error('[Cleanup] Opportunistic cleanup failed:', error);
        return 0;
    }
}
