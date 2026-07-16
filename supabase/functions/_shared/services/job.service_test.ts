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

Deno.test('claimNextStep maps an empty queue and a claimed message', async () => {
    let response: unknown = [];
    const client = {
        rpc() {
            return Promise.resolve({ data: response, error: null });
        },
    } as unknown as SupabaseClient;
    const service = new JobService(client);

    assertEquals(await service.claimNextStep('worker-1'), null);

    response = [
        {
            claimed_job_id: 'job-1',
            claimed_step_name: 'extraction',
            claimed_payload: { blockCount: 9 },
            claimed_attempt_count: 2,
        },
    ];
    assertEquals(await service.claimNextStep('worker-1'), {
        jobId: 'job-1',
        stepName: 'extraction',
        payload: { blockCount: 9 },
        attemptCount: 2,
    });
});

Deno.test('advanceStep sends one atomic checkpoint transition', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
        rpc(name: string, args: Record<string, unknown>) {
            calls.push({ name, args });
            return Promise.resolve({ data: 'validation', error: null });
        },
    } as unknown as SupabaseClient;
    const service = new JobService(client);

    const result = await service.advanceStep({
        jobId: 'job-1',
        stepName: 'consolidation',
        workerId: 'worker-1',
        outputRef: { consolidated: true },
        nextPayload: { source: 'checkpoint' },
    });

    assertEquals(result, 'validation');
    assertEquals(calls[0], {
        name: 'advance_analysis_step',
        args: {
            p_job_id: 'job-1',
            p_step_name: 'consolidation',
            p_worker_id: 'worker-1',
            p_output_ref: { consolidated: true },
            p_next_payload: { source: 'checkpoint' },
            p_final_result: null,
        },
    });
});

Deno.test('yieldStep releases a successful partial slice through its RPC', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
        rpc(name: string, args: Record<string, unknown>) {
            calls.push({ name, args });
            return Promise.resolve({ data: true, error: null });
        },
    } as unknown as SupabaseClient;
    const service = new JobService(client);

    await service.yieldStep('job-1', 'extraction', 'worker-1', { blockCount: 2 });

    assertEquals(calls[0], {
        name: 'yield_analysis_step',
        args: {
            p_job_id: 'job-1',
            p_step_name: 'extraction',
            p_worker_id: 'worker-1',
            p_output_ref: { blockCount: 2 },
        },
    });
});

Deno.test('setExternalResources uses one atomic database checkpoint', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
        rpc(name: string, args: Record<string, unknown>) {
            calls.push({ name, args });
            return Promise.resolve({ data: null, error: null });
        },
    } as unknown as SupabaseClient;
    const service = new JobService(client);

    await service.setExternalResources('job-1', 'vs-1', ['file-1', 'file-2'], ['doc-1', 'doc-2']);

    assertEquals(calls[0], {
        name: 'record_analysis_external_resources',
        args: {
            p_job_id: 'job-1',
            p_vector_store_id: 'vs-1',
            p_file_ids: ['file-1', 'file-2'],
            p_document_ids: ['doc-1', 'doc-2'],
        },
    });
});
