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

/**
 * Cleanup a specific job's OpenAI resources.
 * Called when TTL expires or on-demand.
 */
export async function cleanupJobResources(
    openai: OpenAI,
    vectorStoreId?: string | null,
    fileIds?: string[] | null
): Promise<void> {
    console.log('[Cleanup] Starting resource cleanup...');

    const tasks: Promise<void>[] = [];

    if (vectorStoreId) {
        tasks.push(
            openai.vectorStores
                .del(vectorStoreId)
                .then(() => console.log(`[Cleanup] Vector Store deleted: ${vectorStoreId}`))
                .catch((error) => console.error(`[Cleanup] Failed to delete vector store ${vectorStoreId}:`, error))
        );
    }

    if (fileIds && fileIds.length > 0) {
        tasks.push(
            Promise.allSettled(fileIds.map((fileId) => openai.files.del(fileId))).then((results) => {
                for (let i = 0; i < results.length; i++) {
                    if (results[i].status === 'fulfilled') {
                        console.log(`[Cleanup] File deleted: ${fileIds[i]}`);
                    } else {
                        console.error(
                            `[Cleanup] Failed to delete file ${fileIds[i]}:`,
                            (results[i] as PromiseRejectedResult).reason
                        );
                    }
                }
            })
        );
    }

    await Promise.all(tasks);
}

/**
 * Opportunistic cleanup: run at the start of new analysis requests.
 * Checks for expired jobs and cleans their resources.
 */
export async function runOpportunisticCleanup(
    openai: OpenAI,
    getExpiredJobs: () => Promise<Array<{ vector_store_id?: string; file_ids?: string[] }>>
): Promise<number> {
    try {
        const expiredJobs = await getExpiredJobs();
        let cleaned = 0;

        for (const job of expiredJobs) {
            await cleanupJobResources(openai, job.vector_store_id, job.file_ids);
            cleaned++;
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
