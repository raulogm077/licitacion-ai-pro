export interface FactExpectation {
    path: string;
    equals?: string | number | boolean;
    contains?: string;
    tolerance?: number;
}

export interface AbsenceExpectation {
    path: string;
}

export interface EvidenceExpectation {
    fieldPath: string;
}

export interface EvaluationThresholds {
    factAccuracy: number;
    absenceAccuracy: number;
    evidenceGrounding: number;
}

export interface EvaluationExpectation {
    facts: FactExpectation[];
    absentFields: AbsenceExpectation[];
    evidenceFields: EvidenceExpectation[];
    sourceText: string;
    allowedQuality: Array<'COMPLETO' | 'PARCIAL' | 'VACIO'>;
    minimumScores: EvaluationThresholds;
    maxDegradedBlocks: number;
}

export interface EvaluationMetrics {
    schemaValid: number;
    factAccuracy: number;
    absenceAccuracy: number;
    evidenceGrounding: number;
    qualityMatch: number;
    degradedBlockCount: number;
}

export interface EvaluationScore {
    passed: boolean;
    metrics: EvaluationMetrics;
    failures: string[];
}

interface ExtractionDiagnosticsLike {
    degradedBlocks?: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function getPath(value: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, segment) => asRecord(current)?.[segment], value);
}

function normalizeText(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function ratio(passed: number, total: number): number {
    return total === 0 ? 1 : passed / total;
}

function factMatches(actual: unknown, expectation: FactExpectation): boolean {
    if (expectation.contains !== undefined) {
        return typeof actual === 'string' && normalizeText(actual).includes(normalizeText(expectation.contains));
    }

    if (typeof expectation.equals === 'number') {
        return (
            typeof actual === 'number' &&
            Math.abs(actual - expectation.equals) <= (expectation.tolerance ?? Number.EPSILON)
        );
    }

    return actual === expectation.equals;
}

function evidencePathMatches(actual: string, expected: string): boolean {
    return (
        actual === expected ||
        actual.endsWith(`.${expected}`) ||
        expected.endsWith(`.${actual}`) ||
        actual.split('.').at(-1) === expected.split('.').at(-1)
    );
}

function isGroundedQuote(quote: unknown, sourceText: string): boolean {
    if (typeof quote !== 'string' || quote.trim().length === 0) return false;
    return normalizeText(sourceText).includes(normalizeText(quote));
}

export function scoreEvaluation(
    output: unknown,
    expected: EvaluationExpectation,
    extractionDiagnostics: ExtractionDiagnosticsLike = {}
): EvaluationScore {
    const failures: string[] = [];
    const root = asRecord(output);
    const schemaValid = root && asRecord(root.result) && asRecord(root.workflow) ? 1 : 0;

    const passedFacts = expected.facts.filter((fact) => factMatches(getPath(output, fact.path), fact)).length;
    const factAccuracy = ratio(passedFacts, expected.facts.length);

    const passedAbsences = expected.absentFields.filter(
        (field) => getPath(output, `${field.path}.status`) === 'no_encontrado'
    ).length;
    const absenceAccuracy = ratio(passedAbsences, expected.absentFields.length);

    const evidences = getPath(output, 'workflow.evidences');
    const evidenceRows = Array.isArray(evidences) ? evidences : [];
    const groundedEvidenceFields = expected.evidenceFields.filter((field) =>
        evidenceRows.some((candidate) => {
            const record = asRecord(candidate);
            return (
                typeof record?.fieldPath === 'string' &&
                evidencePathMatches(record.fieldPath, field.fieldPath) &&
                isGroundedQuote(record.quote, expected.sourceText)
            );
        })
    ).length;
    const evidenceGrounding = ratio(groundedEvidenceFields, expected.evidenceFields.length);

    const quality = getPath(output, 'workflow.quality.overall');
    const qualityMatch = expected.allowedQuality.includes(quality as 'COMPLETO' | 'PARCIAL' | 'VACIO') ? 1 : 0;
    const degradedBlockCount = extractionDiagnostics.degradedBlocks?.length ?? 0;

    if (schemaValid === 0) failures.push('La salida no contiene result + workflow válidos.');
    if (factAccuracy < expected.minimumScores.factAccuracy) {
        failures.push(
            `Exactitud de hechos ${factAccuracy.toFixed(3)} < ${expected.minimumScores.factAccuracy.toFixed(3)}.`
        );
    }
    if (absenceAccuracy < expected.minimumScores.absenceAccuracy) {
        failures.push(
            `Exactitud de ausencias ${absenceAccuracy.toFixed(3)} < ${expected.minimumScores.absenceAccuracy.toFixed(3)}.`
        );
    }
    if (evidenceGrounding < expected.minimumScores.evidenceGrounding) {
        failures.push(
            `Grounding de evidencias ${evidenceGrounding.toFixed(3)} < ${expected.minimumScores.evidenceGrounding.toFixed(3)}.`
        );
    }
    if (qualityMatch === 0) {
        failures.push(`Calidad recibida=${String(quality)}; permitida=${expected.allowedQuality.join('|')}.`);
    }
    if (degradedBlockCount > expected.maxDegradedBlocks) {
        failures.push(`Bloques degradados=${degradedBlockCount}; máximo permitido=${expected.maxDegradedBlocks}.`);
    }

    return {
        passed: failures.length === 0,
        metrics: {
            schemaValid,
            factAccuracy,
            absenceAccuracy,
            evidenceGrounding,
            qualityMatch,
            degradedBlockCount,
        },
        failures,
    };
}
