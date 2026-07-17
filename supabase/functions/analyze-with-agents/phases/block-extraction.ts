/**
 * Fase C: Extracción por Bloques.
 *
 * Cada bloque se ejecuta a través del SDK `@openai/agents` (Agent + run() +
 * outputGuardrails). El fallback legacy basado en Responses API directa fue
 * eliminado una vez confirmada la paridad de salida en producción. Si en el
 * futuro hubiera que revertir, el path correcto es `git revert` del PR de
 * migración M2 — no reintroducir un flag inline.
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
    BLOCK_MAX_RETRIES,
    BLOCK_RETRY_MAX_DELAY_MS,
    GUIDE_EXCERPT_LENGTH,
    GUIDE_EXCERPT_TEMPLATE_LENGTH,
} from '../../_shared/config.ts';
import { mapOpenAIError } from '../../_shared/utils/error.utils.ts';
import { callWithTimeout } from '../../_shared/utils/timeout.ts';
import { getRetryReason, retryWithBackoff, isRetryableError } from '../../_shared/utils/retry.ts';
import type { RetryReason } from '../../_shared/utils/retry.ts';
import { runWithConcurrency } from '../../_shared/utils/concurrency.ts';

export interface BlockExtractionInput {
    openai: OpenAI;
    vectorStoreId: string;
    documentMap: DocumentMap;
    guideContent: string;
    template?: {
        name: string;
        schema: Array<{ name: string; type: string; description?: string; required?: boolean }>;
    } | null;
    /**
     * Pre-built PipelineContext from the orchestrator. Now mandatory (the
     * legacy fallback that allowed undefined was removed).
     */
    context: PipelineContext;
    onProgress?: (msg: string, blockIndex: number, totalBlocks: number) => void;
    onRetry?: (details: RetryNotification) => void;
    /** Durable worker resume/checkpoint hooks. Legacy SSE callers omit both. */
    resume?: Partial<BlockExtractionResult>;
    onCheckpoint?: (checkpoint: BlockExtractionResult) => Promise<void>;
    /** Worker slice size. Omit to preserve legacy all-block execution. */
    maxNewBlocks?: number;
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
    const {
        vectorStoreId,
        documentMap,
        guideContent,
        template,
        context,
        onProgress,
        onRetry,
        resume,
        onCheckpoint,
        maxNewBlocks,
    } = input;

    const totalBlocks = BLOCK_NAMES.length;
    const blockResults = new Map<BlockName, BlockResult>();
    for (const block of resume?.blocks || []) {
        if (BLOCK_NAMES.includes(block.blockName)) blockResults.set(block.blockName, block);
    }
    let completedCount = blockResults.size;
    let sawRateLimit = resume?.diagnostics?.sawRateLimit ?? false;
    let degradedByRateLimit = resume?.diagnostics?.degradedByRateLimit ?? false;
    const degradedBlocks = new Set<string>(resume?.diagnostics?.degradedBlocks || []);
    let customTemplate = resume?.customTemplate;
    let templateWarning = resume?.templateWarning;
    let checkpointChain = Promise.resolve();

    context.guideExcerpt = guideContent.substring(0, GUIDE_EXCERPT_LENGTH);
    context.documentMap = documentMap;

    const buildCheckpoint = (): BlockExtractionResult => ({
        blocks: BLOCK_NAMES.map((blockName) => blockResults.get(blockName)).filter((block): block is BlockResult =>
            Boolean(block)
        ),
        customTemplate,
        templateWarning,
        diagnostics: {
            sawRateLimit,
            degradedByRateLimit,
            degradedBlocks: [...degradedBlocks],
        },
    });

    const persistCheckpoint = async () => {
        if (!onCheckpoint) return;
        const snapshot = buildCheckpoint();
        const write = checkpointChain.then(() => onCheckpoint(snapshot));
        checkpointChain = write.catch(() => undefined);
        await write;
    };

    const pendingEntries = BLOCK_NAMES.map((blockName, i) => ({ blockName, i })).filter(
        ({ blockName }) => !blockResults.has(blockName)
    );
    const selectedEntries = Number.isInteger(maxNewBlocks)
        ? pendingEntries.slice(0, Math.max(0, Number(maxNewBlocks)))
        : pendingEntries;
    const tasks = selectedEntries.map(({ blockName, i }) => async (): Promise<BlockResult> => {
        onProgress?.(`Extrayendo: ${blockName}...`, i, totalBlocks);
        let blockResult: BlockResult;
        try {
            blockResult = await extractBlockWithAgent(blockName, vectorStoreId, context, (retry) => {
                if (retry.reason === 'rate_limit') sawRateLimit = true;
                onRetry?.({ ...retry, blockIndex: i + 1, totalBlocks });
            });
        } catch (error) {
            console.error(`[Extraction] Block ${blockName} failed:`, error);
            if (getRetryReason(error) === 'rate_limit') {
                sawRateLimit = true;
                degradedByRateLimit = true;
                degradedBlocks.add(blockName);
            }
            blockResult = emptyBlockResult(blockName, `Error extrayendo bloque ${blockName}: ${mapOpenAIError(error)}`);
        }

        blockResults.set(blockName, blockResult);
        completedCount = blockResults.size;
        console.log(
            `[Extraction] Block ${blockName} checkpointed (${completedCount}/${totalBlocks}): ${blockResult.warnings.length} warnings`
        );
        onProgress?.(`Completado: ${blockName} (${completedCount}/${totalBlocks})`, completedCount - 1, totalBlocks);
        await persistCheckpoint();
        return blockResult;
    });

    await runWithConcurrency(tasks, BLOCK_CONCURRENCY);

    if (
        template &&
        template.schema &&
        template.schema.length > 0 &&
        blockResults.size === totalBlocks &&
        (maxNewBlocks === undefined || selectedEntries.length === 0) &&
        customTemplate === undefined &&
        templateWarning === undefined
    ) {
        onProgress?.('Extrayendo plantilla personalizada...', totalBlocks, totalBlocks + 1);
        try {
            customTemplate = await extractCustomTemplateWithAgent(vectorStoreId, template, guideContent, context);
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
        await persistCheckpoint();
    }

    await checkpointChain;
    return buildCheckpoint();
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
        // Retry transient 429/5xx once with capped backoff. Timeouts are not
        // retryable, and a JSON-guardrail trip has its own reinforce path
        // below — never funnel it through the transient-error backoff.
        result = await retryWithBackoff(() => attempt(false), {
            maxRetries: BLOCK_MAX_RETRIES,
            baseDelayMs: 1000,
            maxDelayMs: BLOCK_RETRY_MAX_DELAY_MS,
            label: `Block ${blockName}`,
            shouldRetry: (err) => !(err instanceof OutputGuardrailTripwireTriggered) && isRetryableError(err),
            onRetry: (info) =>
                onRetry({
                    blockName,
                    attempt: info.attempt,
                    maxAttempts: info.maxAttempts,
                    waitMs: info.waitMs,
                    reason: info.reason,
                }),
        });
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
