import { describe, expect, it } from 'vitest';
import { parseSseChunk, StreamEventParseError } from '../stream-events';

describe('parseSseChunk', () => {
  it('parses valid events from a complete chunk (happy path)', () => {
    const chunk = [
      'data: {"type":"heartbeat","timestamp":1,"eventsProcessed":10}',
      'data: {"type":"agent_message","timestamp":2,"content":"processing"}',
      'data: {"type":"complete","timestamp":3,"result":{"ok":true}}',
      '',
    ].join('\n');

    const result = parseSseChunk(chunk);

    expect(result.buffer).toBe('');
    expect(result.events).toHaveLength(3);
    expect(result.events[0]).toMatchObject({ type: 'heartbeat', timestamp: 1, eventsProcessed: 10 });
    expect(result.events[1]).toMatchObject({ type: 'agent_message', timestamp: 2, content: 'processing' });
    expect(result.events[2]).toMatchObject({ type: 'complete', timestamp: 3, result: { ok: true } });
  });

  it('keeps incomplete line in buffer and parses only complete lines (edge case)', () => {
    const partialChunk = 'data: {"type":"heartbeat","timestamp":100}\ndata: {"type":"agent_message"';
    const first = parseSseChunk(partialChunk);

    expect(first.events).toHaveLength(1);
    expect(first.events[0]).toMatchObject({ type: 'heartbeat', timestamp: 100 });
    expect(first.buffer).toBe('data: {"type":"agent_message"');

    const second = parseSseChunk(',"timestamp":101,"content":"partial done"}\n', first.buffer);
    expect(second.events).toHaveLength(1);
    expect(second.events[0]).toMatchObject({ type: 'agent_message', timestamp: 101, content: 'partial done' });
    expect(second.buffer).toBe('');
  });


  it('supports final buffer flush when stream ends without trailing newline (edge case)', () => {
    const first = parseSseChunk('data: {"type":"complete","timestamp":9,"result":{"done":true}}');

    expect(first.events).toHaveLength(0);
    expect(first.buffer).toBe('data: {"type":"complete","timestamp":9,"result":{"done":true}}');

    const flushed = parseSseChunk('\n', first.buffer);
    expect(flushed.events).toHaveLength(1);
    expect(flushed.events[0]).toMatchObject({ type: 'complete', timestamp: 9, result: { done: true } });
    expect(flushed.buffer).toBe('');
  });

  it('returns empty events and buffer for empty chunk input (edge case)', () => {
    const result = parseSseChunk('');

    expect(result.events).toEqual([]);
    expect(result.buffer).toBe('');
  });
  it('ignores blank lines and non-data lines (edge case)', () => {
    const chunk = [
      'event: ping',
      '',
      'data: {"type":"heartbeat","timestamp":7}',
      'id: 42',
      '',
    ].join('\n');

    const result = parseSseChunk(chunk);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ type: 'heartbeat', timestamp: 7 });
  });

  it('throws StreamEventParseError on invalid JSON payload (error handling)', () => {
    const invalidJsonChunk = 'data: {"type":"heartbeat","timestamp":1\n';

    expect(() => parseSseChunk(invalidJsonChunk)).toThrow(StreamEventParseError);
    expect(() => parseSseChunk(invalidJsonChunk)).toThrow('Invalid JSON in SSE payload');
  });

  it('throws StreamEventParseError on schema mismatch (error handling)', () => {
    const invalidSchemaChunk = 'data: {"type":"heartbeat"}\n';

    expect(() => parseSseChunk(invalidSchemaChunk)).toThrow(StreamEventParseError);
    expect(() => parseSseChunk(invalidSchemaChunk)).toThrow('Invalid SSE event schema');
  });
});
