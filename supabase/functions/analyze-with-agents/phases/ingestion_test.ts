/**
 * Tests for the vector-store indexing wait (Fase A).
 *
 * Regression for the 2026-07-12 misdiagnosis: a transient error on the
 * status poll (e.g. a 429 while the account is rate-limited) must be retried
 * — and if it still fails, it must NOT be reported as a document problem
 * ("OCR pobre/señal baja"): the counts are simply unknown.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { runIngestion, waitForVectorStoreIndexing } from './ingestion.ts';

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
    const fake = fakeOpenAI([
        rateLimitError(),
        rateLimitError(),
        {
            completed: 1,
            in_progress: 0,
            failed: 0,
        },
    ]);

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

Deno.test('runIngestion accepts binary Storage sources without base64 conversion', async () => {
    const uploadedNames: string[] = [];
    const checkpoints: Array<{ vectorStoreId: string; fileIds: string[]; fileNames: string[] }> = [];
    const client = {
        files: {
            create: ({ file }: { file: File }) => {
                uploadedNames.push(file.name);
                return Promise.resolve({ id: `file-${uploadedNames.length}` });
            },
            delete: () => Promise.resolve(),
        },
        vectorStores: {
            create: ({ file_ids }: { file_ids: string[] }) => Promise.resolve({ id: 'vs-binary', file_ids }),
            retrieve: () =>
                Promise.resolve({
                    file_counts: { completed: 2, in_progress: 0, failed: 0 },
                }),
        },
        // deno-lint-ignore no-explicit-any
    } as any;

    const result = await runIngestion({
        openai: client,
        filename: 'principal.pdf',
        sourceFiles: [
            { name: 'principal.pdf', data: new Blob(['%PDF-1']) },
            { name: 'anexo.txt', data: new Blob(['texto']), mimeType: 'text/plain' },
        ],
        onResourcesCreated: (resources) => {
            checkpoints.push(resources);
            return Promise.resolve();
        },
    });

    assertEquals(uploadedNames, ['principal.pdf', 'anexo.txt']);
    assertEquals(result.vectorStoreId, 'vs-binary');
    assertEquals(result.fileIds, ['file-1', 'file-2']);
    assertEquals(result.diagnostics.completedFiles, 2);
    assertEquals(checkpoints, [
        {
            vectorStoreId: 'vs-binary',
            fileIds: ['file-1', 'file-2'],
            fileNames: ['principal.pdf', 'anexo.txt'],
        },
    ]);
});

Deno.test('runIngestion deletes uploaded files when vector-store creation fails', async () => {
    const deleted: string[] = [];
    const client = {
        files: {
            create: () => Promise.resolve({ id: 'file-orphan-candidate' }),
            delete: (fileId: string) => {
                deleted.push(fileId);
                return Promise.resolve();
            },
        },
        vectorStores: {
            create: () => Promise.reject(new Error('vector store unavailable')),
        },
        // deno-lint-ignore no-explicit-any
    } as any;

    let threw = false;
    try {
        await runIngestion({
            openai: client,
            filename: 'principal.pdf',
            sourceFiles: [{ name: 'principal.pdf', data: new Blob(['%PDF-1']) }],
        });
    } catch {
        threw = true;
    }

    assert(threw, 'the vector-store error must be propagated to the durable retry policy');
    assertEquals(deleted, ['file-orphan-candidate']);
});

Deno.test('runIngestion cleans OpenAI resources when the durable checkpoint fails', async () => {
    const deletedFiles: string[] = [];
    const deletedVectorStores: string[] = [];
    const client = {
        files: {
            create: () => Promise.resolve({ id: 'file-uncheckpointed' }),
            delete: (fileId: string) => {
                deletedFiles.push(fileId);
                return Promise.resolve();
            },
        },
        vectorStores: {
            create: () => Promise.resolve({ id: 'vs-uncheckpointed' }),
            delete: (vectorStoreId: string) => {
                deletedVectorStores.push(vectorStoreId);
                return Promise.resolve();
            },
        },
        // deno-lint-ignore no-explicit-any
    } as any;

    let threw = false;
    try {
        await runIngestion({
            openai: client,
            filename: 'principal.pdf',
            sourceFiles: [{ name: 'principal.pdf', data: new Blob(['%PDF-1']) }],
            onResourcesCreated: () => Promise.reject(new Error('database unavailable')),
        });
    } catch {
        threw = true;
    }

    assert(threw, 'the checkpoint error must be propagated to the durable retry policy');
    assertEquals(deletedFiles, ['file-uncheckpointed']);
    assertEquals(deletedVectorStores, ['vs-uncheckpointed']);
});
