import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.3';
import { JobService } from './job.service.ts';

Deno.test('createDurableJob maps the idempotent RPC result', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
        rpc(name: string, args: Record<string, unknown>) {
            calls.push({ name, args });
            return Promise.resolve({
                data: [{ job_id: 'job-1', created: true }],
                error: null,
            });
        },
    } as unknown as SupabaseClient;

    const service = new JobService(client);
    const result = await service.createDurableJob(
        'user-1',
        'pliego.pdf',
        'idem-1234',
        'a'.repeat(64),
        { pipeline: 'v1' },
        '2026-07-17T00:00:00.000Z'
    );

    assertEquals(result, { jobId: 'job-1', created: true });
    assertEquals(calls[0].name, 'create_analysis_job');
    assertEquals(calls[0].args.p_idempotency_key, 'idem-1234');
});

Deno.test('startStep enqueues before trying to claim the lease', async () => {
    const calls: string[] = [];
    const client = {
        rpc(name: string) {
            calls.push(name);
            if (name === 'claim_analysis_step') {
                return Promise.resolve({ data: true, error: null });
            }
            return Promise.resolve({ data: [{ queue_message_id: 42 }], error: null });
        },
    } as unknown as SupabaseClient;

    const service = new JobService(client);
    await service.startStep('job-1', 'ingestion_map', 'worker-1');

    assertEquals(calls, ['enqueue_analysis_step', 'claim_analysis_step']);
});

Deno.test('reclaimStaleSteps maps the sweep rows for logging', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
        rpc(name: string, args: Record<string, unknown>) {
            calls.push({ name, args });
            return Promise.resolve({
                data: [
                    { reclaimed_job_id: 'job-1', reclaimed_step_name: 'extraction', outcome: 'dead_letter' },
                    { reclaimed_job_id: 'job-2', reclaimed_step_name: null, outcome: 'orphaned' },
                ],
                error: null,
            });
        },
    } as unknown as SupabaseClient;

    const service = new JobService(client);
    const reclaimed = await service.reclaimStaleSteps(5);

    assertEquals(calls[0].name, 'reclaim_stale_analysis_steps');
    assertEquals(calls[0].args.p_limit, 5);
    assertEquals(reclaimed, [
        { jobId: 'job-1', stepName: 'extraction', outcome: 'dead_letter' },
        { jobId: 'job-2', stepName: null, outcome: 'orphaned' },
    ]);
});

Deno.test('reclaimStaleSteps treats an empty sweep as a no-op', async () => {
    const client = {
        rpc() {
            return Promise.resolve({ data: null, error: null });
        },
    } as unknown as SupabaseClient;

    assertEquals(await new JobService(client).reclaimStaleSteps(), []);
});
