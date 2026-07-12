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

import { Agent, fileSearchTool } from '../../_shared/agents/sdk.ts';
import type { PipelineContext } from '../../_shared/agents/context.ts';
import { jsonShapeGuardrail } from '../../_shared/agents/guardrails.ts';
import { BLOCK_SCHEMAS } from '../../_shared/schemas/blocks.ts';
import type { BlockName } from '../../_shared/schemas/blocks.ts';
import { OPENAI_MODEL } from '../../_shared/config.ts';
import { buildBlockSystemPrompt, BLOCK_USER_PROMPTS, withJsonReinforcement } from '../prompts/index.ts';

export function buildBlockAgent(blockName: BlockName, vectorStoreId: string) {
    return new Agent<PipelineContext>({
        name: `blockExtractor:${blockName}`,
        model: OPENAI_MODEL,
        // `instructions(runContext, agent)`: destructuring `{ context }` yields
        // the PipelineContext directly — do NOT add a second `.context` hop.
        instructions: ({ context }) => {
            if (!context.documentMap) {
                throw new Error(`blockExtractor:${blockName} requires PipelineContext.documentMap`);
            }
            return buildBlockSystemPrompt(blockName, context.documentMap, context.guideExcerpt);
        },
        tools: [
            // fileSearchTool(vectorStoreIds, options?) — the ids are the FIRST
            // positional argument. Passing an options-style object made the SDK
            // send vector_store_ids=[{...}] and OpenAI reject with 400
            // invalid_type (prod bug 2026-07-12, second of the @ts-nocheck family).
            fileSearchTool([vectorStoreId]),
        ],
        // @ts-expect-error — SDK 0.3.x type/runtime mismatch: the config type wants the
        // *defined* guardrail shape, but Runner normalizes via define*Guardrail({ name, execute })
        // (run.js), so { name, execute } is the correct authoring shape. See ARCHITECTURE §8.9.
        outputGuardrails: [jsonShapeGuardrail(BLOCK_SCHEMAS[blockName], blockName)],
    });
}

export function buildBlockInput(blockName: BlockName, reinforceJson: boolean | undefined): string {
    return withJsonReinforcement(BLOCK_USER_PROMPTS[blockName], reinforceJson);
}
