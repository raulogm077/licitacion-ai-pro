/**
 * Fase C agent factory — produces one Agent per block.
 *
 * Each block (datosGenerales, economico, ...) needs its own dynamic instructions
 * (the block-specific user prompt + the generic system prompt with the document
 * map embedded) and its own output guardrail (each BLOCK_SCHEMAS[name] is a
 * different Zod schema). Wrapping all 9 in one Agent and switching by context
 * would mean a single guardrail validating against the wrong schema for 8/9
 * runs, so we materialise 9 distinct Agents.
 *
 * Hard constraint (per @openai/agents@0.3.1 + Responses API):
 *   `file_search` HostedTool and `outputType` with a JSON schema are
 *   incompatible. We keep the default `outputType: 'text'` and validate the
 *   JSON shape via the jsonShapeGuardrail output guardrail. DO NOT add
 *   `outputType` here — doing so would silently disable file_search.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — npm: specifier resolved by Deno
import { Agent, fileSearchTool } from '../../_shared/agents/sdk.ts';
import type { PipelineContext } from '../../_shared/agents/context.ts';
import { jsonShapeGuardrail } from '../../_shared/agents/guardrails.ts';
import { BLOCK_SCHEMAS } from '../../_shared/schemas/blocks.ts';
import type { BlockName } from '../../_shared/schemas/blocks.ts';
import { OPENAI_MODEL } from '../../_shared/config.ts';
import { buildBlockSystemPrompt, BLOCK_USER_PROMPTS, withJsonReinforcement } from '../prompts/index.ts';

/**
 * Build a per-block Agent. The factory is invoked per-request because
 * fileSearchTool binds vectorStoreIds at construction time.
 *
 * Dynamic instructions read from the run-time PipelineContext:
 *   - documentMap is required (set in phase B)
 *   - guideExcerpt is required (set in phase C just before run())
 *   - reinforceJson is set on the retry path after
 *     OutputGuardrailTripwireTriggered
 */
export function buildBlockAgent(blockName: BlockName, vectorStoreId: string) {
    return new Agent<PipelineContext>({
        name: `blockExtractor:${blockName}`,
        model: OPENAI_MODEL,
        instructions: ({ context }) => {
            const ctx = context.context;
            if (!ctx.documentMap) {
                throw new Error(`blockExtractor:${blockName} requires PipelineContext.documentMap`);
            }
            return buildBlockSystemPrompt(blockName, ctx.documentMap, ctx.guideExcerpt);
        },
        tools: [
            fileSearchTool({
                vectorStoreIds: [vectorStoreId],
            }),
        ],
        outputGuardrails: [jsonShapeGuardrail(BLOCK_SCHEMAS[blockName], blockName)],
    });
}

/**
 * Build the user-side input for a block run. Kept as a tiny helper so the
 * orchestrator doesn't need to know about the reinforce-JSON suffix.
 */
export function buildBlockInput(blockName: BlockName, reinforceJson: boolean | undefined): string {
    return withJsonReinforcement(BLOCK_USER_PROMPTS[blockName], reinforceJson);
}
