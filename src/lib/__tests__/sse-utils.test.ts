import { describe, expect, it } from 'vitest';
import { parseSseEvents } from '../sse-utils';

describe('parseSseEvents', () => {
    it('parses complete events from a buffer (happy path)', () => {
        const buffer = 'data: {"type":"status","message":"ok"}\n\n';
        const result = parseSseEvents(buffer);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe('status');
        expect(result.remaining).toBe('');
    });

    it('keeps partial events in remaining buffer (edge case)', () => {
        const partial = 'data: {"type":"status","message":"parcial"}';
        const result = parseSseEvents(partial);
        expect(result.events).toHaveLength(0);
        expect(result.remaining).toBe(partial);
    });

    it('emits error event on invalid JSON (error handling)', () => {
        const buffer = 'data: {"type": "status", "message": }\n\n';
        const result = parseSseEvents(buffer);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe('error');
    });
});
