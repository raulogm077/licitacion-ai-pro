/**
 * Fase C: Extracción por Bloques.
 *
 * Two implementations live behind the USE_AGENTS_SDK feature flag:
 *   - default (USE_AGENTS_SDK ≠ 'false'): @openai/agents path.
 *   - USE_AGENTS_SDK='false' (M2 escape hatch): forwards to
 *     phases/block-extraction.legacy.ts.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { run, OutputGuardrailTripwireTriggered } from '../../_shared/agents/sdk.ts';
import OpenAI from 'npm:openai@6.33.0';
import { BLOCK_NAMES, BLOCK_SCHEMAS } from '../../_shared/schemas/blocks.ts';
import type { BlockName } from '../../_shared/schemas/blocks.ts';
import type { DocumentMap } from '../../_shared/schemas/document-map.ts';
import type { PipelineContext } from '../../_shared/agents/context.ts';
import { extractOutputText, parseJsonFromText } from '../../_shared/agents/guardrails.ts';
import { buildBlockAgent, buildBlockInput } from '../agents/block-extractor.agent.ts';
import { buildCustomTemplateAgent } from '../agents/custom-template.agent.ts';
import { buildCustomTemplateUser } from '../prompts/index.ts';
import {
    API_CALL_TIMEOUT_MS,
    BLOCK_CONCURRENCY,
    GUIDE_EXCERPT_LENGTH,
    GUIDE_EXCERPT_TEMPLATE_LENGTH,
} from '../../_shared/config.ts';
import { mapOpenAIError } from '../../_shared/utils/error.utils.ts';
import { callWithTimeout } from '../../_shared/utils/timeout.ts';
import { getRetryReason } from '../../_shared/utils/retry.ts';
import type { RetryReason } from '../../_shared/utils/retry.ts';
import {
    runBlockExtractionLegacy,
    type BlockExtractionInputLegacy,
} from './block-extraction.legacy.ts';

export interface BlockExtractionInput {
    openai: OpenAI;
    vectorStoreId: string;
    documentMap: DocumentMap;
    guideContent: string;
    template?: {
        name: string;
        schema: Array<{ name: string; type: string; description?: string; required?: boolean }>;
    } | null;
    context?: PipelineContext;
    onProgress?: (msg: string, blockIndex: number, totalBlocks: number) => void;
    onRetry?: (details: RetryNotification) => void;
}

export interface BlockResult {
    blockName: BlockName;
    data: unknown;
    evidences: Array<{ fieldPath: string; quote: string; pageHint?: string; confidence?: number }>;
    warnings: string[];
    ambiguous_fields: string[];
}

export interface BlockExtractionResult {
    blocks: BlockResult[];
    customTemplate?: Record<string, unknown>;
    templateWarning?: string;
    diagnostics: BlockExtractionDiagnostics;
}

export interface BlockExtractionDiagnostics {
    sawRateLimit: boolean;
    degradedByRateLimit: boolean;
    degradedBlocks: string[];
}

export interface RetryNotification {
    blockName: BlockName | 'custom_template';
    attempt: number;
    maxAttempts: number;
    waitMs: number;
    reason: RetryReason;
    blockIndex?: number;
    totalBlocks?: number;
}

function useAgentsSdk(): boolean {
    return Deno.env.get('USE_AGENTS_SDK') !== 'false';
}

async function runWithConcurrency<T>(items: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
    const results: T[] = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
        while (nextIndex < items.length) {
            const idx = nextIndex++;
            results[idx] = await items[idx]();
        }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

function emptyBlockResult(blockName: BlockName, warning: string): BlockResult {
    return {
        blockName,
        data: {},
        evidences: [],
        warnings: [warning],
        ambiguous_fields: [],
    };
}

export async function runBlockExtraction(input: BlockExtractionInput): Promise<BlockExtractionResult> {
    if (!useAgentsSdk()) {
        const legacy = await runBlockExtractionLegacy(input as unknown as BlockExtractionInputLegacy);
        return legacy as BlockExtractionResult;
    }

    const { vectorStoreId, documentMap, guideContent, template, context, onProgress, onRetry } = input;
    if (!context) {
        throw new Error(
            'runBlockExtraction (SDK path) requires PipelineContext. Set USE_AGENTS_SDK=false to fall back to legacy.'
        );
    }

    const totalBlocks = BLOCK_NAMES.length;
    let completedCount = 0;
    let sawRateLimit = false;
    let degradedByRateLimit = false;
    const degradedBlocks = new Set<string>();

    context.guideExcerpt = guideContent.substring(0, GUIDE_EXCERPT_LENGTH);
    context.documentMap = documentMap;

    const tasks = BLOCK_NAMES.map((blockName, i) => async (): Promise<BlockResult> => {
        onProgress?.(`Extrayendo: ${blockName}...`, i, totalBlocks);
        try {
            const result = await extractBlockWithAgent(blockName, vectorStoreId, context, (retry) => {
                if (retry.reason === 'rate_limit') sawRateLimit = true;
                onRetry?.({ ...retry, blockIndex: i + 1, totalBlocks });
            });
            completedCount++;
            console.log(
                `[Extraction] Block ${blockName} completed (${completedCount}/${totalBlocks}): ${result.warnings.length} warnings`
            );
            onProgress?.(
                `Completado: ${blockName} (${completedCount}/${totalBlocks})`,
                completedCount - 1,
                totalBlocks
            );
            return result;
        } catch (error) {
            completedCount++;
            console.error(`[Extraction] Block ${blockName} failed:`, error);
            if (getRetryReason(error) === 'rate_limit') {
                sawRateLimit = true;
                degradedByRateLimit = true;
                degradedBlocks.add(blockName);
            }
            return emptyBlockResult(blockName, `Error extrayendo bloque ${blockName}: ${mapOpenAIError(error)}`);
        }
    });

    const blocks = await runWithConcurrency(tasks, BLOCK_CONCURRENCY);

    let customTemplate: Record<string, unknown> | undefined;
    let templateWarning: string | undefined;
    if (template && template.schema && template.schema.length > 0) {
        onProgress?.('Extrayendo plantilla personalizada...', totalBlocks, totalBlocks + 1);
        try {
            customTemplate = await extractCustomTemplateWithAgent(
                vectorStoreId,
                template,
                guideContent,
                context
            );
        } catch (error) {
            const errorMsg = mapOpenAIError(error);
            console.error('[Extraction] Custom template extraction failed:', errorMsg);
            if (getRetryReason(error) === 'rate_limit') {
                sawRateLimit = true;
                degradedByRateLimit = true;
                degradedBlocks.add('custom_template');
            }
            templateWarning = `⚠️ Plantilla personalizada: ${errorMsg}`;
            onProgress?.(templateWarning, totalBlocks, totalBlocks);
        }
    }

    return {
        blocks,
        customTemplate,
        templateWarning,
        diagnostics: {
            sawRateLimit,
            degradedByRateLimit,
            degradedBlocks: [...degradedBlocks],
        },
    };
}

async function extractBlockWithAgent(
    blockName: BlockName,
    vectorStoreId: string,
    sharedContext: PipelineContext,
    onRetry: (details: RetryNotification) => void
): Promise<BlockResult> {
    const agent = buildBlockAgent(blockName, vectorStoreId);
    const blockSchema = BLOCK_SCHEMAS[blockName];

    const attempt = async (reinforceJson: boolean) => {
        const ctx: PipelineContext = { ...sharedContext, blockName, reinforceJson };
        const userInput = buildBlockInput(blockName, reinforceJson);
        return await callWithTimeout(
            run(agent, userInput, { context: ctx }),
            API_CALL_TIMEOUT_MS,
            `Block ${blockName}`
        );
    };

    let result;
    try {
        result = await attempt(false);
    } catch (err) {
        if (err instanceof OutputGuardrailTripwireTriggered) {
            onRetry({
                blockName,
                attempt: 2,
                maxAttempts: 2,
                waitMs: 0,
                reason: 'unknown',
            });
            try {
                result = await attempt(true);
            } catch (err2) {
                if (err2 instanceof OutputGuardrailTripwireTriggered) {
                    return emptyBlockResult(
                        blockName,
                        `Bloque ${blockName} falló validación JSON tras reintento de refuerzo`
                    );
                }
                throw err2;
            }
        } else {
            throw err;
        }
    }

    const guardrailHit = result.outputGuardrailResults?.find(
        (r: { outputInfo?: { label?: string; value?: unknown } }) => r.outputInfo?.label === blockName
    );
    let parsed: { data?: unknown; evidences?: unknown[]; warnings?: string[]; ambiguous_fields?: string[] };
    if (guardrailHit?.outputInfo?.value) {
        parsed = guardrailHit.outputInfo.value as typeof parsed;
    } else {
        const text = extractOutputText(result.finalOutput ?? result);
        parsed = parseJsonFromText(text) as typeof parsed;
        const validated = blockSchema.safeParse(parsed);
        if (!validated.success) {
            console.warn(`[Extraction] Validation warning for ${blockName}:`, validated.error.message);
            return {
                blockName,
                data: parsed.data || {},
                evidences: (parsed.evidences || []) as BlockResult['evidences'],
                warnings: [
                    ...(parsed.warnings || []),
                    `Schema validation warning: ${validated.error.message.substring(0, 200)}`,
                ],
                ambiguous_fields: (parsed.ambiguous_fields || []) as string[],
            };
        }
        parsed = validated.data;
    }

    return {
        blockName,
        data: parsed.data || {},
        evidences: (parsed.evidences || []) as BlockResult['evidences'],
        warnings: parsed.warnings || [],
        ambiguous_fields: (parsed.ambiguous_fields || []) as string[],
    };
}

async function extractCustomTemplateWithAgent(
    vectorStoreId: string,
    template: NonNullable<BlockExtractionInput['template']>,
    guideContent: string,
    sharedContext: PipelineContext
): Promise<Record<string, unknown>> {
    const agent = buildCustomTemplateAgent(vectorStoreId);
    const ctx: PipelineContext = {
        ...sharedContext,
        guideExcerpt: guideContent.substring(0, GUIDE_EXCERPT_TEMPLATE_LENGTH),
        customTemplate: template,
    };
    const userInput = buildCustomTemplateUser(template.schema);
    const result = await callWithTimeout(
        run(agent, userInput, { context: ctx }),
        API_CALL_TIMEOUT_MS,
        'Custom template'
    );

    const guardrailHit = result.outputGuardrailResults?.find(
        (r: { outputInfo?: { label?: string; value?: unknown } }) => r.outputInfo?.label === 'custom-template'
    );
    if (guardrailHit?.outputInfo?.value) {
        return guardrailHit.outputInfo.value as Record<string, unknown>;
    }
    const text = extractOutputText(result.finalOutput ?? result);
    return parseJsonFromText(text) as Record<string, unknown>;
}
