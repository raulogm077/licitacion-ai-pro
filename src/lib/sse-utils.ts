import { LicitacionData } from '../types';
import { logger } from './logger';

export type StreamPayload =
    | { type: 'status'; message: string }
    | { type: 'chunk'; message: string }
    | { type: 'result'; data: LicitacionData }
    | { type: 'error'; message: string };

type ParseResult = {
    events: StreamPayload[];
    remaining: string;
};

const DATA_PREFIX = /^data:\s?/;

function parseEventPayload(eventBlock: string): StreamPayload[] {
    const dataLines = eventBlock
        .split('\n')
        .filter(line => DATA_PREFIX.test(line));

    if (dataLines.length === 0) {
        return [];
    }

    const dataString = dataLines
        .map(line => line.replace(DATA_PREFIX, ''))
        .join('\n')
        .trim();

    if (!dataString) {
        return [];
    }

    try {
        const payload = JSON.parse(dataString) as StreamPayload;
        return [payload];
    } catch (error) {
        logger.error('Error parsing SSE payload:', error);
        return [{ type: 'error', message: 'Respuesta inválida del servidor.' }];
    }
}

export function parseSseEvents(buffer: string): ParseResult {
    const events: StreamPayload[] = [];
    const blocks = buffer.split('\n\n');
    const remaining = blocks.pop() ?? '';

    for (const block of blocks) {
        events.push(...parseEventPayload(block));
    }

    return { events, remaining };
}
