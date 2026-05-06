/**
 * SupabaseLogTraceProcessor — bridges @openai/agents tracing into Supabase logs.
 *
 * Why a custom processor instead of the default SDK exporter?
 *   - Supabase Edge Functions have no outbound HTTP retry budget for
 *     telemetry sinks; we cannot afford to drop frames or block the SSE stream
 *     waiting on an external tracing endpoint.
 *   - The default OpenAI tracing exporter ships spans to api.openai.com which
 *     is fine for offline debugging but useless for production triage where
 *     we want grep-able lines next to the rest of the function logs.
 *
 * Output format (one line per event):
 *   [trace] {"event":"trace_start"|"trace_end"|"span_start"|"span_end",...}
 *
 * Anyone tailing `supabase functions logs analyze-with-agents` can `grep [trace]`
 * to reconstruct the full agent run including duration, tokens (when
 * available), and error fields.
 */

// SDK trace types are duck-typed — we only access well-known fields. This keeps
// us decoupled from minor SDK churn between 0.3.x releases.
interface SdkTrace {
    traceId?: string;
    name?: string;
    metadata?: Record<string, unknown>;
    error?: unknown;
}

interface SdkSpan {
    spanId?: string;
    traceId?: string;
    parentId?: string | null;
    name?: string;
    startedAt?: string | number;
    endedAt?: string | number;
    error?: unknown;
    spanData?: Record<string, unknown>;
}

export interface TraceProcessor {
    onTraceStart?(trace: SdkTrace): void | Promise<void>;
    onTraceEnd?(trace: SdkTrace): void | Promise<void>;
    onSpanStart?(span: SdkSpan): void | Promise<void>;
    onSpanEnd?(span: SdkSpan): void | Promise<void>;
    forceFlush?(): void | Promise<void>;
    shutdown?(): void | Promise<void>;
}

function safeJson(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch {
        return JSON.stringify({ unserializable: String(value) });
    }
}

function toMs(t: string | number | undefined): number | undefined {
    if (t === undefined) return undefined;
    if (typeof t === 'number') return t;
    const parsed = Date.parse(t);
    return Number.isNaN(parsed) ? undefined : parsed;
}

export class SupabaseLogTraceProcessor implements TraceProcessor {
    onTraceStart(trace: SdkTrace): void {
        console.log(
            `[trace] ${safeJson({
                event: 'trace_start',
                traceId: trace.traceId,
                name: trace.name,
                metadata: trace.metadata,
            })}`
        );
    }

    onTraceEnd(trace: SdkTrace): void {
        console.log(
            `[trace] ${safeJson({
                event: 'trace_end',
                traceId: trace.traceId,
                name: trace.name,
                error: trace.error
                    ? { message: trace.error instanceof Error ? trace.error.message : String(trace.error) }
                    : undefined,
            })}`
        );
    }

    onSpanStart(span: SdkSpan): void {
        console.log(
            `[trace] ${safeJson({
                event: 'span_start',
                spanId: span.spanId,
                traceId: span.traceId,
                parentId: span.parentId,
                name: span.name,
                startedAt: span.startedAt,
            })}`
        );
    }

    onSpanEnd(span: SdkSpan): void {
        const startedAtMs = toMs(span.startedAt);
        const endedAtMs = toMs(span.endedAt);
        const durationMs = startedAtMs && endedAtMs ? endedAtMs - startedAtMs : undefined;

        console.log(
            `[trace] ${safeJson({
                event: 'span_end',
                spanId: span.spanId,
                traceId: span.traceId,
                name: span.name,
                durationMs,
                error: span.error
                    ? { message: span.error instanceof Error ? span.error.message : String(span.error) }
                    : undefined,
                spanData: span.spanData,
            })}`
        );
    }

    async forceFlush(): Promise<void> {
        // No buffering — console.log is the sink.
    }

    async shutdown(): Promise<void> {
        // No buffering — nothing to flush.
    }
}
