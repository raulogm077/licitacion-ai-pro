import { z } from 'zod';

/**
 * WHY: Define a strict contract for SSE events to detect backend/client drift early
 * and fail with actionable errors instead of silently ignoring malformed payloads.
 */
const streamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('heartbeat'),
    timestamp: z.number(),
    eventsProcessed: z.number().optional(),
  }),
  z.object({
    type: z.literal('agent_message'),
    timestamp: z.number(),
    content: z.union([z.string(), z.unknown()]).optional(),
  }),
  z.object({
    type: z.literal('complete'),
    timestamp: z.number(),
    result: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('error'),
    timestamp: z.number(),
    message: z.string().optional(),
  }),
]);

export type StreamEvent = z.infer<typeof streamEventSchema>;

export class StreamEventParseError extends Error {
  public readonly rawLine: string;

  constructor(message: string, rawLine: string) {
    super(message);
    this.name = 'StreamEventParseError';
    this.rawLine = rawLine;
  }
}

/**
 * WHY: Keep stream chunk handling deterministic and testable by isolating parser state
 * transitions (buffer + completed lines).
 */
export interface StreamChunkParseResult {
  events: StreamEvent[];
  buffer: string;
}

/**
 * Parses an SSE chunk into validated events and returns the remaining buffer.
 *
 * Contract:
 * - Only lines with `data: ` are considered.
 * - Blank/non-data lines are ignored.
 * - Invalid JSON or invalid schema throws StreamEventParseError.
 */
export function parseSseChunk(chunk: string, previousBuffer = ''): StreamChunkParseResult {
  const combined = `${previousBuffer}${chunk}`;
  const lines = combined.split('\n');
  const buffer = lines.pop() ?? '';
  const events: StreamEvent[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data: ')) {
      continue;
    }

    const payload = line.slice(6);
    let parsed: unknown;

    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new StreamEventParseError('Invalid JSON in SSE payload', line);
    }

    const validated = streamEventSchema.safeParse(parsed);
    if (!validated.success) {
      throw new StreamEventParseError(
        `Invalid SSE event schema: ${validated.error.issues.map(issue => issue.message).join(', ')}`,
        line,
      );
    }

    events.push(validated.data);
  }

  return { events, buffer };
}
