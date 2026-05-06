/**
 * Fase B: Mapa Documental — thin wrapper around the documentMap Agent.
 *
 * The legacy implementation (pre-migration) called openai.responses.create
 * directly and parsed/validated the output inline. The migration moves that
 * logic into:
 *   - prompts/index.ts            (instruction strings)
 *   - agents/document-map.agent.ts (Agent + tools + guardrails)
 *   - _shared/agents/guardrails.ts (extractOutputText, parseJsonFromText,
 *                                   jsonShapeGuardrail)
 *
 * What remains here is the orchestration: build the per-request agent,
 * invoke `run()` with the PipelineContext, surface progress via the SSE
 * callback, and return the validated DocumentMap to the orchestrator.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { run, OutputGuardrailTripwireTriggered } from '../../_shared/agents/sdk.ts';
import type { DocumentMap } from '../../_shared/schemas/document-map.ts';
import { DocumentMapSchema } from '../../_shared/schemas/document-map.ts';
import type { PipelineContext } from '../../_shared/agents/context.ts';
import { extractOutputText, parseJsonFromText } from '../../_shared/agents/guardrails.ts';
import { buildDocumentMapAgent } from '../agents/document-map.agent.ts';
import { API_CALL_TIMEOUT_MS, GUIDE_EXCERPT_MAP_LENGTH } from '../../_shared/config.ts';
import { callWithTimeout } from '../../_shared/utils/timeout.ts';

export interface DocumentMapInput {
    context: PipelineContext;
    guideContent: string;
    onProgress?: (msg: string) => void;
    signal?: AbortSignal;
}

export async function runDocumentMap(input: DocumentMapInput): Promise<DocumentMap> {
    const { context, guideContent, onProgress, signal } = input;

    onProgress?.('Analizando estructura documental...');

    context.guideExcerpt = guideContent.substring(0, GUIDE_EXCERPT_MAP_LENGTH);

    const agent = buildDocumentMapAgent(context.vectorStoreId);

    let validated: DocumentMap;
    try {
        const result = await callWithTimeout(
            run(agent, '', { context, signal }),
            API_CALL_TIMEOUT_MS,
            'Mapa documental'
        );

        const guardrailHit = result.outputGuardrailResults?.find(
            (r: { outputInfo?: { label?: string; value?: unknown } }) => r.outputInfo?.label === 'document-map'
        );
        if (guardrailHit?.outputInfo?.value) {
            validated = guardrailHit.outputInfo.value as DocumentMap;
        } else {
            const text = extractOutputText(result.finalOutput ?? result);
            validated = DocumentMapSchema.parse(parseJsonFromText(text));
        }
    } catch (err) {
        if (err instanceof OutputGuardrailTripwireTriggered) {
            throw new Error(
                `DocumentMap no válido tras la primera ejecución del agente: ${err.message}`
            );
        }
        throw err;
    }

    console.log(
        `[DocumentMap] Identified ${validated.documentos.length} documents, lotes: ${validated.lotes.hayLotes}`
    );
    onProgress?.(`Mapa documental: ${validated.documentos.length} documentos identificados`);

    context.documentMap = validated;
    return validated;
}
