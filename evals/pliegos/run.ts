import OpenAI from 'npm:openai@6.33.0';
import { basename, resolve } from 'node:path';

import { ANALYSIS_RUNTIME_VERSIONS } from '../../supabase/functions/_shared/ai-runtime-version.ts';
import { API_CALL_TIMEOUT_MS } from '../../supabase/functions/_shared/config.ts';
import { createPipelineContext } from '../../supabase/functions/_shared/agents/context.ts';
import { callWithTimeout } from '../../supabase/functions/_shared/utils/timeout.ts';
import { cleanupJobResources } from '../../supabase/functions/analyze-with-agents/cleanup.ts';
import { GUIDE_CONTENT } from '../../supabase/functions/analyze-with-agents/guide-content.ts';
import { runIngestion, type IngestionResult } from '../../supabase/functions/analyze-with-agents/phases/ingestion.ts';
import { runDocumentMap } from '../../supabase/functions/analyze-with-agents/phases/document-map.ts';
import {
    runBlockExtraction,
    type BlockExtractionDiagnostics,
} from '../../supabase/functions/analyze-with-agents/phases/block-extraction.ts';
import { runConsolidation } from '../../supabase/functions/analyze-with-agents/phases/consolidation.ts';
import {
    runValidation,
    type ValidationOutput,
} from '../../supabase/functions/analyze-with-agents/phases/validation.ts';
import { scoreEvaluation, type EvaluationExpectation, type EvaluationScore } from './score.ts';

interface EvaluationDocument {
    path: string;
    name?: string;
}

interface EvaluationCase {
    datasetVersion: string;
    id: string;
    description: string;
    documents: EvaluationDocument[];
    expected: EvaluationExpectation;
}

interface CaseReport {
    id: string;
    description: string;
    status: 'passed' | 'failed' | 'error';
    durationMs: number;
    phaseLatencyMs: Record<string, number>;
    score?: EvaluationScore;
    cleanupSucceeded: boolean;
    error?: string;
}

const CASES_URL = new URL('./cases.jsonl', import.meta.url);
const RESULT_DIR = resolve(Deno.cwd(), 'evals/results');
const RUNTIME_FINGERPRINT_FILES = [
    'supabase/functions/_shared/config.ts',
    'supabase/functions/_shared/schemas/canonical.ts',
    'supabase/functions/analyze-with-agents/prompts/index.ts',
    'supabase/functions/analyze-with-agents/agents/document-map.agent.ts',
    'supabase/functions/analyze-with-agents/agents/block-extractor.agent.ts',
    'supabase/functions/analyze-with-agents/phases/ingestion.ts',
    'supabase/functions/analyze-with-agents/phases/document-map.ts',
    'supabase/functions/analyze-with-agents/phases/block-extraction.ts',
    'supabase/functions/analyze-with-agents/phases/consolidation.ts',
    'supabase/functions/analyze-with-agents/phases/validation.ts',
] as const;

function parseCases(raw: string): EvaluationCase[] {
    return raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
            try {
                return JSON.parse(line) as EvaluationCase;
            } catch (error) {
                throw new Error(`JSONL inválido en cases.jsonl:${index + 1}: ${safeError(error)}`);
            }
        });
}

function bytesToBase64(bytes: Uint8Array): string {
    const chunkSize = 32_768;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

function safeError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]').slice(0, 800);
}

async function sha256Files(paths: readonly string[]): Promise<string> {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    for (const path of paths) {
        const content = await Deno.readFile(resolve(Deno.cwd(), path));
        const header = encoder.encode(`${path}\n${content.length}\n`);
        chunks.push(header, content);
        totalLength += header.length + content.length;
    }

    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
    }

    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', combined));
    return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function timed<T>(phase: string, latencies: Record<string, number>, operation: () => Promise<T>): Promise<T> {
    const started = performance.now();
    try {
        return await operation();
    } finally {
        latencies[phase] = Math.round(performance.now() - started);
    }
}

async function loadDocuments(documents: EvaluationDocument[]) {
    if (documents.length === 0) throw new Error('El caso no contiene documentos.');

    return await Promise.all(
        documents.map(async (document) => {
            const absolutePath = resolve(Deno.cwd(), document.path);
            return {
                name: document.name ?? basename(absolutePath),
                base64: bytesToBase64(await Deno.readFile(absolutePath)),
            };
        })
    );
}

async function runCase(openai: OpenAI, testCase: EvaluationCase): Promise<CaseReport> {
    const started = performance.now();
    const phaseLatencyMs: Record<string, number> = {};
    let ingestion: IngestionResult | undefined;
    let extractionDiagnostics: BlockExtractionDiagnostics | undefined;
    let output: ValidationOutput | undefined;
    let error: string | undefined;
    let cleanupSucceeded = true;

    console.log(`\n[eval] START ${testCase.id} · ${testCase.description}`);

    try {
        const documents = await loadDocuments(testCase.documents);
        const [primary, ...additional] = documents;
        const requestId = crypto.randomUUID();

        ingestion = await timed('ingestion', phaseLatencyMs, () =>
            callWithTimeout(
                runIngestion({
                    openai,
                    pdfBase64: primary.base64,
                    filename: primary.name,
                    files: additional,
                    onProgress: ({ message }) => console.log(`[eval][ingestion] ${message}`),
                }),
                API_CALL_TIMEOUT_MS * 2,
                'Eval ingestion'
            )
        );

        const context = createPipelineContext({
            vectorStoreId: ingestion.vectorStoreId,
            fileNames: ingestion.fileNames,
            guideExcerpt: '',
            userId: 'local-eval',
            requestId,
            customTemplate: null,
        });

        const documentMap = await timed('document_map', phaseLatencyMs, () =>
            runDocumentMap({
                context,
                guideContent: GUIDE_CONTENT,
                onProgress: (message) => console.log(`[eval][document_map] ${message}`),
            })
        );

        const extraction = await timed('extraction', phaseLatencyMs, () =>
            runBlockExtraction({
                openai,
                vectorStoreId: ingestion!.vectorStoreId,
                documentMap,
                guideContent: GUIDE_CONTENT,
                context,
                template: null,
                onProgress: (message) => console.log(`[eval][extraction] ${message}`),
                onRetry: ({ blockName, attempt, maxAttempts, reason }) =>
                    console.warn(`[eval][retry] block=${blockName} attempt=${attempt}/${maxAttempts} reason=${reason}`),
            })
        );
        extractionDiagnostics = extraction.diagnostics;

        const consolidated = await timed('consolidation', phaseLatencyMs, () =>
            Promise.resolve(runConsolidation({ blocks: extraction.blocks, customTemplate: extraction.customTemplate }))
        );

        output = await timed('validation', phaseLatencyMs, () =>
            Promise.resolve(
                runValidation({
                    consolidated,
                    ingestion: ingestion!.diagnostics,
                    extraction: extraction.diagnostics,
                })
            )
        );
    } catch (caught) {
        error = safeError(caught);
    } finally {
        if (ingestion) {
            const cleanupStarted = performance.now();
            try {
                cleanupSucceeded = await cleanupJobResources(openai, ingestion.vectorStoreId, ingestion.fileIds);
            } catch (caught) {
                cleanupSucceeded = false;
                console.error(`[eval][cleanup] ${safeError(caught)}`);
            }
            phaseLatencyMs.cleanup = Math.round(performance.now() - cleanupStarted);
        }
    }

    const durationMs = Math.round(performance.now() - started);
    if (error || !output) {
        console.error(`[eval] ERROR ${testCase.id} · ${error ?? 'salida ausente'}`);
        return {
            id: testCase.id,
            description: testCase.description,
            status: 'error',
            durationMs,
            phaseLatencyMs,
            cleanupSucceeded,
            error: error ?? 'El pipeline no produjo salida.',
        };
    }

    const score = scoreEvaluation(output, testCase.expected, extractionDiagnostics);
    if (!cleanupSucceeded) score.failures.push('La limpieza de recursos OpenAI no se completó.');
    score.passed = score.failures.length === 0;
    const status = score.passed ? 'passed' : 'failed';
    console.log(`[eval] ${status.toUpperCase()} ${testCase.id} · ${durationMs}ms`);
    for (const failure of score.failures) console.error(`[eval]   - ${failure}`);

    return {
        id: testCase.id,
        description: testCase.description,
        status,
        durationMs,
        phaseLatencyMs,
        score,
        cleanupSucceeded,
    };
}

async function writeReport(report: unknown, startedAt: string): Promise<void> {
    await Deno.mkdir(RESULT_DIR, { recursive: true });
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    const timestamp = startedAt.replace(/[:.]/g, '-');
    await Promise.all([
        Deno.writeTextFile(resolve(RESULT_DIR, 'latest.json'), serialized),
        Deno.writeTextFile(resolve(RESULT_DIR, `${timestamp}.json`), serialized),
    ]);
}

async function main(): Promise<void> {
    const cases = parseCases(await Deno.readTextFile(CASES_URL));
    const selectedId = Deno.args.find((arg) => arg.startsWith('--case='))?.split('=', 2)[1];

    if (Deno.args.includes('--list')) {
        for (const testCase of cases) console.log(`${testCase.id}\t${testCase.description}`);
        return;
    }

    const selectedCases = selectedId ? cases.filter((testCase) => testCase.id === selectedId) : cases;
    if (selectedCases.length === 0) throw new Error(`Caso no encontrado: ${selectedId}`);

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY no está disponible. Configúrala en .env.local antes del eval live.');
    }

    const startedAt = new Date().toISOString();
    const runtimeFingerprint = await sha256Files(RUNTIME_FINGERPRINT_FILES);
    const openai = new OpenAI({ apiKey });
    const caseReports: CaseReport[] = [];

    for (const testCase of selectedCases) caseReports.push(await runCase(openai, testCase));

    const report = {
        reportVersion: 1,
        datasetVersion: selectedCases[0].datasetVersion,
        startedAt,
        finishedAt: new Date().toISOString(),
        runtime: ANALYSIS_RUNTIME_VERSIONS,
        runtimeFingerprint,
        summary: {
            total: caseReports.length,
            passed: caseReports.filter((result) => result.status === 'passed').length,
            failed: caseReports.filter((result) => result.status === 'failed').length,
            errors: caseReports.filter((result) => result.status === 'error').length,
        },
        cases: caseReports,
    };

    await writeReport(report, startedAt);
    console.log(`\n[eval] Resumen: ${report.summary.passed}/${report.summary.total} casos superados.`);
    console.log('[eval] Métricas guardadas en evals/results/ (ignorado por Git).');
    if (report.summary.passed !== report.summary.total) Deno.exitCode = 1;
}

await main();
