import { LicitacionContent } from '../types';

/**
 * Builds the initial (v1) analysis version entry for a freshly analyzed
 * result. Shared between the persist path (db.service.saveLicitacion, new
 * envelope) and the load-time normalization (licitacion.store.loadLicitacion),
 * which previously duplicated this exact literal.
 *
 * NOTE: only the version *entry* is shared. The surrounding envelope/workflow
 * construction legitimately differs between the two paths (persist builds a
 * quality report and appends versions against an existing envelope; load only
 * normalizes Content into an Envelope shape), so it is intentionally not
 * unified here.
 */
export function buildInitialVersion(result: LicitacionContent, now: string) {
    return {
        version: 1,
        status: 'succeeded' as const,
        created_at: now,
        model: 'ai-analysis',
        schema_version: 'v1',
        prompt_version: 'v1',
        result,
    };
}
