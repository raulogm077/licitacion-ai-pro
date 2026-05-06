/**
 * Reusable guardrails for the @openai/agents pipeline.
 *
 * Why guardrails (and not just post-processing)?
 *   - The SDK fires guardrails inside the same span as the agent run, so trace
 *     output groups validation failures with the call that produced them.
 *   - On failure the SDK raises OutputGuardrailTripwireTriggered, which we
 *     catch in the orchestrator to trigger the JSON-reinforcement retry path
 *     (replaces the legacy ad-hoc retry in block-extraction.ts).
 *
 * Guardrails return `{ tripwireTriggered, outputInfo }`. tripwireTriggered=true
 * tells the SDK to abort the run with the corresponding error class.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { z } from 'npm:zod@3.25.76';
import type { PipelineContext } from './context.ts';

export interface GuardrailResult<T = unknown> {
    tripwireTriggered: boolean;
    outputInfo: T;
}

/**
 * SDK-shaped output guardrail callback signature. We type it loosely because
 * the exact import path differs between SDK minor versions and we want the
 * factory to compose with whatever the runtime expects without a hard import.
 */
type OutputGuardrailFn = (input: {
    agentOutput: string | { text?: string };
    context?: { context?: PipelineContext };
}) => Promise<GuardrailResult>;

type InputGuardrailFn = (input: {
    input: string | Array<{ content?: string }>;
    context?: { context?: PipelineContext };
}) => Promise<GuardrailResult>;

// ─── Helpers extracted from the legacy phases/document-map.ts ────────────────

/**
 * Normalize the SDK's `RunResult.finalOutput` (or the raw Responses API output
 * we used to handle in document-map.ts) into a plain string.
 */
export function extractOutputText(output: unknown): string {
    if (typeof output === 'string') return output;
    if (output && typeof output === 'object') {
        const obj = output as { text?: unknown; output?: unknown };
        if (typeof obj.text === 'string') return obj.text;
        if (Array.isArray(obj.output)) {
            for (const item of obj.output as Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>) {
                if (item.type === 'message' && Array.isArray(item.content)) {
                    for (const c of item.content) {
                        if (c.type === 'output_text' && typeof c.text === 'string') return c.text;
                    }
                }
            }
        }
    }
    throw new Error('Unable to extract output text — agent returned unsupported shape');
}

/**
 * Robust JSON extraction. Order of strategies (matches legacy behavior):
 *   1. JSON.parse(text) directly
 *   2. Strip markdown code fences and parse again
 *   3. Find first `{` to last `}` and parse the substring
 */
export function parseJsonFromText(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        // continue
    }
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) {
        try {
            return JSON.parse(fence[1].trim());
        } catch {
            // continue
        }
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
        try {
            return JSON.parse(text.substring(start, end + 1));
        } catch {
            // fall through
        }
    }
    throw new Error('No se pudo extraer JSON válido de la respuesta');
}

// ─── Output guardrail factories ──────────────────────────────────────────────

/**
 * Validates that the agent output is valid JSON conforming to the supplied
 * Zod schema. On failure, trips the wire so the orchestrator can react.
 *
 * Returns the *parsed* (validated) value via outputInfo so the caller doesn't
 * have to re-parse the same text.
 */
export function jsonShapeGuardrail<T extends z.ZodTypeAny>(schema: T, label: string) {
    const fn: OutputGuardrailFn = async ({ agentOutput }) => {
        const text =
            typeof agentOutput === 'string'
                ? agentOutput
                : extractOutputText(agentOutput);

        let parsed: unknown;
        try {
            parsed = parseJsonFromText(text);
        } catch (err) {
            return {
                tripwireTriggered: true,
                outputInfo: {
                    label,
                    reason: 'invalid_json',
                    error: err instanceof Error ? err.message : String(err),
                    sample: text.substring(0, 240),
                },
            };
        }

        const validated = schema.safeParse(parsed);
        if (!validated.success) {
            return {
                tripwireTriggered: true,
                outputInfo: {
                    label,
                    reason: 'schema_mismatch',
                    issues: validated.error.issues.slice(0, 5),
                    sample: text.substring(0, 240),
                },
            };
        }
        return {
            tripwireTriggered: false,
            outputInfo: { label, reason: 'ok', value: validated.data },
        };
    };
    return { name: `jsonShape:${label}`, execute: fn };
}

// ─── Input guardrail: custom template sanitization ───────────────────────────

/**
 * Refuses runs with > 50 template fields and strips control characters from
 * field names/types/descriptions to neutralize trivial prompt-injection.
 *
 * Why an input guardrail and not just sanitization in the prompt-builder?
 *   - It runs before the LLM call (saves the API call + tokens on rejection).
 *   - Failures appear as InputGuardrailTripwireTriggered, which produces a
 *     dedicated trace span — easier to alert on than a silent string filter.
 */
export const templateSanitizationGuardrail = {
    name: 'templateSanitization',
    async execute({ context }: Parameters<InputGuardrailFn>[0]): Promise<GuardrailResult> {
        const tpl = context?.context?.customTemplate;
        if (!tpl || !Array.isArray(tpl.schema)) {
            return { tripwireTriggered: false, outputInfo: { reason: 'no_template' } };
        }
        if (tpl.schema.length > 50) {
            return {
                tripwireTriggered: true,
                outputInfo: {
                    reason: 'too_many_fields',
                    actual: tpl.schema.length,
                    max: 50,
                },
            };
        }
        const sanitized = tpl.schema.map((f) => ({
            name: f.name.replace(/[\n\r]/g, ' ').substring(0, 100),
            type: f.type.replace(/[\n\r]/g, ' ').substring(0, 50),
            description: (f.description ?? 'Sin descripción').replace(/[\n\r]/g, ' ').substring(0, 200),
            required: !!f.required,
        }));
        // Mutate in place so downstream agent reads the sanitized schema.
        tpl.schema = sanitized;
        return { tripwireTriggered: false, outputInfo: { reason: 'sanitized', count: sanitized.length } };
    },
};
