/**
 * Pipeline Context (RunContext) — typed surface passed to every Agent run().
 *
 * The @openai/agents SDK threads a `RunContext` through tool calls, guardrails,
 * dynamic instructions and trace processors. We use it to inject everything an
 * agent needs without bundling it into prompt strings, which keeps prompts pure
 * and allows the SDK's tracing layer to enrich spans with per-request metadata.
 */

import type { DocumentMap } from '../schemas/document-map.ts';
import type { BlockName } from '../schemas/blocks.ts';

export interface TemplateConfig {
    name: string;
    schema: Array<{ name: string; type: string; description?: string; required?: boolean }>;
}

export interface PipelineContext {
    /** OpenAI vector store id holding the indexed pliego files */
    vectorStoreId: string;
    /** Original file names indexed in this run, used for the DocumentMap prompt */
    fileNames: string[];
    /** DocumentMap output of phase B — populated before phase C starts */
    documentMap?: DocumentMap;
    /** Optional user-provided custom template (phase C, custom_template branch) */
    customTemplate?: TemplateConfig | null;
    /** Truncated guide text to inject as methodology context (NOT a data source) */
    guideExcerpt: string;
    /** Currently extracting block — populated only inside block-extractor.agent dynamic instructions */
    blockName?: BlockName;
    /**
     * When true, the user prompt is augmented with an explicit JSON-only
     * reinforcement clause. Used as the M2 retry path on
     * OutputGuardrailTripwireTriggered (replaces the legacy ad-hoc retry).
     */
    reinforceJson?: boolean;
    /** Authenticated supabase user id, attached to every trace span */
    userId: string;
    /**
     * Per-request id that correlates SSE events, log lines and SDK trace spans.
     * Generated at the top of each request and passed unchanged through phases.
     */
    requestId: string;
}

/**
 * Build a context object — intentionally a plain factory (no class) so it
 * stays trivially serializable in tests and trace processors.
 */
export function createPipelineContext(input: {
    vectorStoreId: string;
    fileNames: string[];
    guideExcerpt: string;
    userId: string;
    requestId: string;
    customTemplate?: TemplateConfig | null;
}): PipelineContext {
    return {
        vectorStoreId: input.vectorStoreId,
        fileNames: input.fileNames,
        guideExcerpt: input.guideExcerpt,
        userId: input.userId,
        requestId: input.requestId,
        customTemplate: input.customTemplate ?? null,
    };
}
