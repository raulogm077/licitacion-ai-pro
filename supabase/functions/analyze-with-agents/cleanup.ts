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

    if (vectorStoreId) {
        try {
            await openai.vectorStores.del(vectorStoreId);
            console.log(`[Cleanup] Vector Store deleted: ${vectorStoreId}`);
        } catch (error) {
            console.error(`[Cleanup] Failed to delete vector store ${vectorStoreId}:`, error);
        }
    }

    if (fileIds && fileIds.length > 0) {
        for (const fileId of fileIds) {
            try {
                await openai.files.del(fileId);
                console.log(`[Cleanup] File deleted: ${fileId}`);
            } catch (error) {
                console.error(`[Cleanup] Failed to delete file ${fileId}:`, error);
            }
        }
    }
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
