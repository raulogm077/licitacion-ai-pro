/**
 * Unit tests for the @openai/agents migration foundation.
 *
 * These tests cover the deterministic logic that does NOT need a live LLM:
 *   - jsonShapeGuardrail trips on malformed JSON and on schema mismatch.
 *   - templateSanitizationGuardrail rejects > 50 fields and strips control
 *     characters from name/type/description.
 *   - extractOutputText / parseJsonFromText handle the same shapes the
 *     legacy phase code handled (Responses API output array, fenced JSON,
 *     trailing text after the JSON object).
 *
 * The agent factories themselves are not tested here — they construct SDK
 * Agent instances which require the SDK to be loaded; that is left to a
 * follow-up integration test that runs against a sandbox vector store.
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { z } from 'npm:zod@3.25.76';
import {
    extractOutputText,
    parseJsonFromText,
    jsonShapeGuardrail,
    templateSanitizationGuardrail,
} from '../../_shared/agents/guardrails.ts';
import { createPipelineContext } from '../../_shared/agents/context.ts';

Deno.test('extractOutputText accepts plain string', () => {
    assertEquals(extractOutputText('hello'), 'hello');
});

Deno.test('extractOutputText reads Responses API output array', () => {
    const response = {
        output: [
            {
                type: 'message',
                content: [{ type: 'output_text', text: '{"foo":1}' }],
            },
        ],
    };
    assertEquals(extractOutputText(response), '{"foo":1}');
});

Deno.test('parseJsonFromText: direct, fenced, embedded', () => {
    assertEquals(parseJsonFromText('{"a":1}'), { a: 1 });
    assertEquals(parseJsonFromText('```json\n{"b":2}\n```'), { b: 2 });
    assertEquals(parseJsonFromText('blabla {"c":3} trailing'), { c: 3 });
});

Deno.test('jsonShapeGuardrail trips on invalid JSON', async () => {
    const guard = jsonShapeGuardrail(z.object({ a: z.number() }), 'test');
    const out = await guard.execute({ agentOutput: 'not json' });
    assert(out.tripwireTriggered);
    assertEquals((out.outputInfo as { reason: string }).reason, 'invalid_json');
});

Deno.test('jsonShapeGuardrail trips on schema mismatch', async () => {
    const guard = jsonShapeGuardrail(z.object({ a: z.number() }), 'test');
    const out = await guard.execute({ agentOutput: '{"a":"oops"}' });
    assert(out.tripwireTriggered);
    assertEquals((out.outputInfo as { reason: string }).reason, 'schema_mismatch');
});

Deno.test('jsonShapeGuardrail returns parsed value on success', async () => {
    const guard = jsonShapeGuardrail(z.object({ a: z.number() }), 'test');
    const out = await guard.execute({ agentOutput: '{"a":42}' });
    assertEquals(out.tripwireTriggered, false);
    assertEquals((out.outputInfo as { value: { a: number } }).value, { a: 42 });
});

Deno.test('templateSanitizationGuardrail rejects > 50 fields', async () => {
    const tpl = {
        name: 'too-many',
        schema: Array.from({ length: 51 }, (_, i) => ({
            name: `f${i}`,
            type: 'string',
            description: 'x',
            required: false,
        })),
    };
    const ctx = createPipelineContext({
        vectorStoreId: 'vs',
        fileNames: [],
        guideExcerpt: '',
        userId: 'u',
        requestId: 'r',
        customTemplate: tpl,
    });
    const out = await templateSanitizationGuardrail.execute({
        input: '',
        context: { context: ctx },
    });
    assert(out.tripwireTriggered);
    assertEquals((out.outputInfo as { reason: string; actual: number }).reason, 'too_many_fields');
    assertEquals((out.outputInfo as { actual: number }).actual, 51);
});

Deno.test('templateSanitizationGuardrail strips control chars', async () => {
    const tpl = {
        name: 't',
        schema: [
            {
                name: 'a\nname',
                type: 'string\rtype',
                description: 'desc\nwith\rcontrols',
                required: true,
            },
        ],
    };
    const ctx = createPipelineContext({
        vectorStoreId: 'vs',
        fileNames: [],
        guideExcerpt: '',
        userId: 'u',
        requestId: 'r',
        customTemplate: tpl,
    });
    const out = await templateSanitizationGuardrail.execute({
        input: '',
        context: { context: ctx },
    });
    assertEquals(out.tripwireTriggered, false);
    // Mutated in place
    assertEquals(ctx.customTemplate?.schema[0].name, 'a name');
    assertEquals(ctx.customTemplate?.schema[0].type, 'string type');
    assertEquals(ctx.customTemplate?.schema[0].description, 'desc with controls');
});

Deno.test('templateSanitizationGuardrail no-op when no template', async () => {
    const ctx = createPipelineContext({
        vectorStoreId: 'vs',
        fileNames: [],
        guideExcerpt: '',
        userId: 'u',
        requestId: 'r',
        customTemplate: null,
    });
    const out = await templateSanitizationGuardrail.execute({
        input: '',
        context: { context: ctx },
    });
    assertEquals(out.tripwireTriggered, false);
    assertEquals((out.outputInfo as { reason: string }).reason, 'no_template');
});
