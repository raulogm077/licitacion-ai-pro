/**
 * Fase C custom-template Agent — extracts user-defined fields from the pliego.
 *
 * Two layers of defence around prompt injection from user-supplied template
 * field metadata:
 *   1. Input guardrail templateSanitizationGuardrail rejects schemas with
 *      > 50 fields and strips control characters from name/type/description.
 *   2. The user prompt builder (buildCustomTemplateUser) re-applies the
 *      same length truncation, so even if the guardrail is bypassed in tests
 *      the prompt is still bounded.
 *
 * Output guardrail enforces the response is a JSON object (record). We do
 * not validate the inner shape because the keys are user-defined and we
 * cannot pre-construct a Zod schema for them — just "is it an object".
 */

import { Agent, fileSearchTool } from '../../_shared/agents/sdk.ts';
import { z } from 'npm:zod@3.25.76';
import type { PipelineContext } from '../../_shared/agents/context.ts';
import { jsonShapeGuardrail, templateSanitizationGuardrail } from '../../_shared/agents/guardrails.ts';
import { OPENAI_MODEL } from '../../_shared/config.ts';
import { buildCustomTemplateSystem } from '../prompts/index.ts';

const CustomTemplateOutputSchema = z.record(z.unknown());

export function buildCustomTemplateAgent(vectorStoreId: string) {
    return new Agent<PipelineContext>({
        name: 'customTemplate',
        model: OPENAI_MODEL,
        // `instructions(runContext, agent)`: `{ context }` IS the PipelineContext.
        instructions: ({ context }) => buildCustomTemplateSystem(context.guideExcerpt),
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
        inputGuardrails: [templateSanitizationGuardrail],
        // @ts-expect-error — SDK 0.3.x type/runtime mismatch: the config type wants the
        // *defined* guardrail shape, but Runner normalizes via define*Guardrail({ name, execute })
        // (run.js), so { name, execute } is the correct authoring shape. See ARCHITECTURE §8.9.
        outputGuardrails: [jsonShapeGuardrail(CustomTemplateOutputSchema, 'custom-template')],
    });
}
