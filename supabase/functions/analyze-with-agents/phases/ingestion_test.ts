/**
 * Tests for the vector-store indexing wait (Fase A).
 *
 * Regression for the 2026-07-12 misdiagnosis: a transient error on the
 * status poll (e.g. a 429 while the account is rate-limited) must be retried
 * — and if it still fails, it must NOT be reported as a document problem
 * ("OCR pobre/señal baja"): the counts are simply unknown.
 */
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { waitForVectorStoreIndexing } from './ingestion.ts';

type FileCounts = { completed: number; in_progress: number; failed: number };

function fakeOpenAI(responses: Array<FileCounts | Error>) {
    let call = 0;
    return {
        calls: () => call,
        client: {
            vectorStores: {
                retrieve: () => {
                    const next = responses[Math.min(call, responses.length - 1)];
                    call += 1;
                    if (next instanceof Error) return Promise.reject(next);
                    return Promise.resolve({ file_counts: next });
                },
            },
            // deno-lint-ignore no-explicit-any
        } as any,
    };
}

const FAST_RETRY = { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 2 };

function rateLimitError(): Error {
    const err = new Error('Rate limit reached') as Error & { status: number };
    err.status = 429;
    return err;
}

Deno.test('waitForVectorStoreIndexing survives transient 429s on the status poll', async () => {
    const fake = fakeOpenAI([rateLimitError(), rateLimitError(), { completed: 1, in_progress: 0, failed: 0 }]);

    const diagnostics = await waitForVectorStoreIndexing(fake.client, 'vs_test', undefined, FAST_RETRY);

    assertEquals(diagnostics.completedFiles, 1);
    assertEquals(diagnostics.indexingTimedOut, false);
    assertEquals(diagnostics.zeroCompletedFiles, false);
    assertEquals(diagnostics.pollFailed, false);
    assert(fake.calls() >= 3, 'must have retried the failing polls');
});

Deno.test('waitForVectorStoreIndexing reports clean diagnostics when indexing settles', async () => {
    const fake = fakeOpenAI([{ completed: 2, in_progress: 0, failed: 1 }]);

    const diagnostics = await waitForVectorStoreIndexing(fake.client, 'vs_test', undefined, FAST_RETRY);

    assertEquals(diagnostics.completedFiles, 2);
    assertEquals(diagnostics.failedFiles, 1);
    assertEquals(diagnostics.indexingTimedOut, false);
    assertEquals(diagnostics.pollFailed, false);
});

Deno.test('waitForVectorStoreIndexing surfaces persistent poll failure to the caller', async () => {
    const fake = fakeOpenAI([rateLimitError()]);

    let threw = false;
    try {
        await waitForVectorStoreIndexing(fake.client, 'vs_test', undefined, FAST_RETRY);
    } catch {
        threw = true;
    }
    assert(threw, 'exhausted retries must reject so runIngestion can classify the abort');
    assert(fake.calls() >= 3, 'must exhaust the retry budget before rejecting');
});
