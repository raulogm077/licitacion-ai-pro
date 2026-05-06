/**
 * Fase B Agent — Document Map.
 *
 * One agent that uses the file_search hosted tool to identify the document
 * structure of the indexed pliego. Returns a JSON-shaped DocumentMap.
 *
 * Hard constraint (per @openai/agents@0.3.1 + Responses API):
 *   `file_search` HostedTool and `outputType` with a JSON schema are
 *   incompatible. We keep the default `outputType: 'text'` and validate the
 *   JSON shape via the jsonShapeGuardrail output guardrail. DO NOT add
 *   `outputType` here — doing so would silently disable file_search.
 *
 * Why build the Agent inside a factory instead of caching a module-level
 * singleton:
 *   - Each request has its own vectorStoreId; the file_search hosted tool
 *     binds vector store ids at construction time in 0.3.x.
 *   - Agent objects are cheap (plain config); per-request construction
 *     adds negligible overhead and avoids a global mutable cache.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — npm: specifier resolved by Deno
import { Agent, fileSearchTool } from '../../_shared/agents/sdk.ts';
import type { PipelineContext } from '../../_shared/agents/context.ts';
import { jsonShapeGuardrail } from '../../_shared/agents/guardrails.ts';
import { DocumentMapSchema } from '../../_shared/schemas/document-map.ts';
import { OPENAI_MODEL } from '../../_shared/config.ts';
import { buildDocumentMapInstructions } from '../prompts/index.ts';

export function buildDocumentMapAgent(vectorStoreId: string) {
    return new Agent<PipelineContext>({
        name: 'documentMap',
        model: OPENAI_MODEL,
        // Dynamic instructions — the SDK calls this each run() with the live
        // context, so we always get the right fileNames + guideExcerpt for the
        // current request without re-instantiating the Agent ourselves.
        instructions: ({ context }) => {
            const ctx = context.context;
            return buildDocumentMapInstructions(ctx.fileNames, ctx.guideExcerpt);
        },
        tools: [
            fileSearchTool({
                vectorStoreIds: [vectorStoreId],
            }),
        ],
        // DO NOT add `outputType` here — it would conflict with file_search.
        // The JSON shape is validated by the output guardrail below.
        outputGuardrails: [jsonShapeGuardrail(DocumentMapSchema, 'document-map')],
    });
}
