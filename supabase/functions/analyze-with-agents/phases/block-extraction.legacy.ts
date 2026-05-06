/**
 * Fase C: Extracción por Bloques — LEGACY implementation.
 *
 * Preserved verbatim from the pre-migration code so the M2 rollout can fall
 * back via the USE_AGENTS_SDK=false feature flag without a redeploy. Removed
 * in M3 once paridad is confirmed in production.
 *
 * Ejecuta una llamada Responses API + file_search por cada bloque temático.
 * Cada bloque tiene su propio prompt y schema de validación.
 */
import OpenAI from 'npm:openai@6.33.0';
import { BLOCK_NAMES, BLOCK_SCHEMAS } from '../../_shared/schemas/blocks.ts';
import type { BlockName } from '../../_shared/schemas/blocks.ts';
import type { DocumentMap } from '../../_shared/schemas/document-map.ts';
import { extractOutputText, parseJsonFromText } from '../../_shared/agents/guardrails.ts';
import {
    OPENAI_MODEL,
    API_CALL_TIMEOUT_MS,
    BLOCK_CONCURRENCY,
    GUIDE_EXCERPT_LENGTH,
    GUIDE_EXCERPT_TEMPLATE_LENGTH,
} from '../../_shared/config.ts';
import { mapOpenAIError } from '../../_shared/utils/error.utils.ts';
import { callWithTimeout } from '../../_shared/utils/timeout.ts';
import { retryWithBackoff, isRetryableError, getRetryReason } from '../../_shared/utils/retry.ts';
import type { RetryReason } from '../../_shared/utils/retry.ts';
import { BLOCK_USER_PROMPTS, buildBlockSystemPrompt } from '../prompts/index.ts';

export interface BlockExtractionInputLegacy {
    openai: OpenAI;
    vectorStoreId: string;
    documentMap: DocumentMap;
    guideContent: string;
    template?: {
        name: string;
        schema: Array<{ name: string; type: string; description?: string; required?: boolean }>;
    } | null;
    onProgress?: (msg: string, blockIndex: number, totalBlocks: number) => void;
    onRetry?: (details: RetryNotificationLegacy) => void;
}

export interface BlockResultLegacy {
    blockName: BlockName;
    data: unknown;
    evidences: Array<{ fieldPath: string; quote: string; pageHint?: string; confidence?: number }>;
    warnings: string[];
    ambiguous_fields: string[];
}

export interface BlockExtractionResultLegacy {
    blocks: BlockResultLegacy[];
    customTemplate?: Record<string, unknown>;
    templateWarning?: string;
    diagnostics: BlockExtractionDiagnosticsLegacy;
}

export interface BlockExtractionDiagnosticsLegacy {
    sawRateLimit: boolean;
    degradedByRateLimit: boolean;
    degradedBlocks: string[];
}

export interface RetryNotificationLegacy {
    blockName: BlockName | 'custom_template';
    attempt: number;
    maxAttempts: number;
    waitMs: number;
    reason: RetryReason;
    blockIndex?: number;
    totalBlocks?: number;
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

export async function runBlockExtractionLegacy(
    input: BlockExtractionInputLegacy
): Promise<BlockExtractionResultLegacy> {
    const { openai, vectorStoreId, documentMap, guideContent, template, onProgress, onRetry } = input;
    const totalBlocks = BLOCK_NAMES.length;
    let completedCount = 0;
    let sawRateLimit = false;
    let degradedByRateLimit = false;
    const degradedBlocks = new Set<string>();

    const guideSummary = guideContent.substring(0, GUIDE_EXCERPT_LENGTH);

    const tasks = BLOCK_NAMES.map((blockName, i) => async (): Promise<BlockResultLegacy> => {
        onProgress?.(`Extrayendo: ${blockName}...`, i, totalBlocks);
        try {
            const result = await extractBlock(
                openai,
                vectorStoreId,
                blockName,
                documentMap,
                guideSummary,
                (retry) => {
                    if (retry.reason === 'rate_limit') sawRateLimit = true;
                    onRetry?.({ ...retry, blockIndex: i + 1, totalBlocks });
                }
            );
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
            return {
                blockName,
                data: {},
                evidences: [],
                warnings: [`Error extrayendo bloque ${blockName}: ${mapOpenAIError(error)}`],
                ambiguous_fields: [],
            };
        }
    });

    const blocks = await runWithConcurrency(tasks, BLOCK_CONCURRENCY);

    let customTemplate: Record<string, unknown> | undefined;
    let templateWarning: string | undefined;
    if (template && template.schema && template.schema.length > 0) {
        onProgress?.('Extrayendo plantilla personalizada...', totalBlocks, totalBlocks + 1);
        try {
            customTemplate = await retryWithBackoff(
                () => extractCustomTemplate(openai, vectorStoreId, template, guideContent),
                {
                    maxRetries: 4,
                    baseDelayMs: 500,
                    label: 'CustomTemplateExtraction',
                    shouldRetry: isRetryableError,
                    onRetry: ({ attempt, maxAttempts, waitMs, reason }) => {
                        if (reason === 'rate_limit') sawRateLimit = true;
                        onRetry?.({
                            blockName: 'custom_template',
                            attempt,
                            maxAttempts,
                            waitMs,
                            reason,
                        });
                    },
                }
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

async function extractBlock(
    openai: OpenAI,
    vectorStoreId: string,
    blockName: BlockName,
    documentMap: DocumentMap,
    guideContent: string,
    onRetry?: (details: RetryNotificationLegacy) => void
): Promise<BlockResultLegacy> {
    const systemPrompt = buildBlockSystemPrompt(blockName, documentMap, guideContent);
    const userPrompt = BLOCK_USER_PROMPTS[blockName];

    const response = await retryWithBackoff(
        () =>
            callWithTimeout(
                openai.responses.create({
                    model: OPENAI_MODEL,
                    input: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    tools: [{ type: 'file_search', vector_store_ids: [vectorStoreId] }],
                }),
                API_CALL_TIMEOUT_MS,
                `Block ${blockName}`
            ),
        {
            maxRetries: 4,
            baseDelayMs: 500,
            label: `BlockExtraction[${blockName}]`,
            shouldRetry: isRetryableError,
            onRetry: ({ attempt, maxAttempts, waitMs, reason }) =>
                onRetry?.({ blockName, attempt, maxAttempts, waitMs, reason }),
        }
    );

    const outputText = extractOutputText(response);

    if (blockName === 'datosGenerales') {
        console.log(`[Extraction:${blockName}] Raw LLM output (first 800 chars):`, outputText.substring(0, 800));
    }

    let parsed: { data?: unknown; evidences?: unknown[]; warnings?: string[]; ambiguous_fields?: string[] };
    try {
        parsed = parseJsonFromText(outputText) as typeof parsed;
    } catch {
        console.warn(`[Extraction] JSON parse failed for ${blockName}, retrying...`);
        const retryResponse = await callWithTimeout(
            openai.responses.create({
                model: OPENAI_MODEL,
                input: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content:
                            userPrompt +
                            '\n\nIMPORTANTE: Tu respuesta anterior no fue JSON válido. Devuelve SOLO JSON, sin texto adicional.',
                    },
                ],
                tools: [{ type: 'file_search', vector_store_ids: [vectorStoreId] }],
            }),
            API_CALL_TIMEOUT_MS,
            `Block ${blockName} retry`
        );
        const retryText = extractOutputText(retryResponse);
        try {
            parsed = parseJsonFromText(retryText) as typeof parsed;
        } catch {
            throw new Error(`JSON inválido en bloque ${blockName} tras reintento`);
        }
    }

    const blockSchema = BLOCK_SCHEMAS[blockName];
    const validated = blockSchema.safeParse(parsed);

    if (validated.success) {
        return {
            blockName,
            data: validated.data.data,
            evidences: validated.data.evidences || [],
            warnings: validated.data.warnings || [],
            ambiguous_fields: validated.data.ambiguous_fields || [],
        };
    }

    console.warn(`[Extraction] Validation warning for ${blockName}:`, validated.error.message);
    return {
        blockName,
        data: parsed.data || {},
        evidences: (parsed.evidences || []) as BlockResultLegacy['evidences'],
        warnings: [
            ...(parsed.warnings || []),
            `Schema validation warning: ${validated.error.message.substring(0, 200)}`,
        ],
        ambiguous_fields: (parsed.ambiguous_fields || []) as string[],
    };
}

async function extractCustomTemplate(
    openai: OpenAI,
    vectorStoreId: string,
    template: NonNullable<BlockExtractionInputLegacy['template']>,
    guideContent: string
): Promise<Record<string, unknown>> {
    if (template.schema.length > 50) {
        throw new Error(`Template has too many fields (${template.schema.length}). Maximum is 50.`);
    }

    const fieldDescriptions = template.schema
        .map((f) => {
            const safeName = f.name.replace(/[\n\r]/g, ' ').substring(0, 100);
            const safeType = f.type.replace(/[\n\r]/g, ' ').substring(0, 50);
            const safeDesc = (f.description || 'Sin descripción').replace(/[\n\r]/g, ' ').substring(0, 200);
            return `- ${safeName} (${safeType}): ${safeDesc} [${f.required ? 'Obligatorio' : 'Opcional'}]`;
        })
        .join('\n');

    const response = await callWithTimeout(
        openai.responses.create({
            model: OPENAI_MODEL,
            input: [
                {
                    role: 'system',
                    content: `Eres un analista de pliegos. Extrae los campos personalizados solicitados del expediente.
GUÍA (solo metodología): ${guideContent.substring(0, GUIDE_EXCERPT_TEMPLATE_LENGTH)}
Devuelve SOLO un JSON con los campos solicitados.`,
                },
                {
                    role: 'user',
                    content: `Extrae estos campos del expediente:\n${fieldDescriptions}\n\nDevuelve un JSON con las claves exactas indicadas.`,
                },
            ],
            tools: [{ type: 'file_search', vector_store_ids: [vectorStoreId] }],
        }),
        API_CALL_TIMEOUT_MS,
        'Custom template'
    );

    const outputText = extractOutputText(response);
    return parseJsonFromText(outputText) as Record<string, unknown>;
}
