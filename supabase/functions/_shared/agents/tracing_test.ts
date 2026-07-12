import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { sanitizeSpanData } from './tracing.ts';

Deno.test('sanitizeSpanData returns undefined for undefined input', () => {
    assertEquals(sanitizeSpanData(undefined), undefined);
});

Deno.test('sanitizeSpanData keeps allowlisted operational keys', () => {
    const result = sanitizeSpanData({
        type: 'generation',
        name: 'block-extractor',
        model: 'gpt-4.1',
        usage: { input_tokens: 10, output_tokens: 5 },
    });
    assertEquals(result, {
        type: 'generation',
        name: 'block-extractor',
        model: 'gpt-4.1',
        usage: { input_tokens: 10, output_tokens: 5 },
    });
});

Deno.test('sanitizeSpanData drops input/output and records redacted keys', () => {
    const result = sanitizeSpanData({
        type: 'generation',
        input: 'contenido del pliego del usuario…',
        output: { text: 'respuesta del modelo' },
        instructions: 'prompt completo',
    });
    assertEquals(result?.type, 'generation');
    assertEquals('input' in (result ?? {}), false);
    assertEquals('output' in (result ?? {}), false);
    assertEquals('instructions' in (result ?? {}), false);
    assertEquals(result?.redacted_keys, ['input', 'output', 'instructions']);
});

Deno.test('sanitizeSpanData truncates long strings in allowlisted keys', () => {
    const long = 'x'.repeat(500);
    const result = sanitizeSpanData({ name: long });
    const name = result?.name as string;
    assertEquals(name.endsWith('…[truncated]'), true);
    assertEquals(name.length <= 200 + '…[truncated]'.length, true);
});

Deno.test('sanitizeSpanData keeps short strings intact', () => {
    const result = sanitizeSpanData({ tool_name: 'file_search' });
    assertEquals(result?.tool_name, 'file_search');
});
