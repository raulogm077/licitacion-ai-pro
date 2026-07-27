import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { BLOCK_NAMES } from '../../_shared/schemas/blocks.ts';
import { runBlockExtraction } from './block-extraction.ts';

Deno.test('runBlockExtraction resumes a fully checkpointed phase without model calls', async () => {
    const blocks = BLOCK_NAMES.map((blockName) => ({
        blockName,
        data: { resumed: blockName },
        evidences: [],
        warnings: [],
        ambiguous_fields: [],
    }));
    let checkpointCalls = 0;

    const result = await runBlockExtraction({
        // No OpenAI surface exists on purpose: a completed checkpoint must not
        // attempt another model call.
        openai: {} as never,
        vectorStoreId: 'vs-resume',
        documentMap: {} as never,
        guideContent: 'guía',
        context: {
            vectorStoreId: 'vs-resume',
            fileNames: ['pliego.pdf'],
            guideExcerpt: '',
            userId: 'user-1',
            requestId: 'worker-1',
        } as never,
        resume: {
            blocks,
            diagnostics: {
                sawRateLimit: true,
                degradedByRateLimit: false,
                degradedBlocks: [],
            },
        },
        onCheckpoint: async () => {
            checkpointCalls += 1;
        },
    });

    assertEquals(result.blocks, blocks);
    assertEquals(result.diagnostics.sawRateLimit, true);
    assertEquals(checkpointCalls, 0);
});

Deno.test('runBlockExtraction honors a zero-size worker slice without touching missing blocks', async () => {
    const firstBlock = {
        blockName: BLOCK_NAMES[0],
        data: { resumed: true },
        evidences: [],
        warnings: [],
        ambiguous_fields: [],
    };

    const result = await runBlockExtraction({
        openai: {} as never,
        vectorStoreId: 'vs-slice',
        documentMap: {} as never,
        guideContent: 'guía',
        context: {
            vectorStoreId: 'vs-slice',
            fileNames: ['pliego.pdf'],
            guideExcerpt: '',
            userId: 'user-1',
            requestId: 'worker-1',
        } as never,
        resume: {
            blocks: [firstBlock],
            diagnostics: { sawRateLimit: false, degradedByRateLimit: false, degradedBlocks: [] },
        },
        maxNewBlocks: 0,
    });

    assertEquals(result.blocks, [firstBlock]);
});
