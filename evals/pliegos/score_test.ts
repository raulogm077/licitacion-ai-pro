import { scoreEvaluation, type EvaluationExpectation } from './score.ts';

function assertEquals(actual: unknown, expected: unknown, message: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message}: esperado=${JSON.stringify(expected)} recibido=${JSON.stringify(actual)}`);
    }
}

const expectation: EvaluationExpectation = {
    facts: [
        { path: 'result.datosGenerales.titulo.value', contains: 'LICENCIA SOFTWARE' },
        { path: 'result.datosGenerales.presupuesto.value', equals: 50_000 },
    ],
    absentFields: [{ path: 'result.datosGenerales.organoContratacion' }],
    evidenceFields: [{ fieldPath: 'datosGenerales.titulo' }, { fieldPath: 'datosGenerales.presupuesto' }],
    sourceText: 'PLIEGO TEST MEMO_P2 SUBASTA LICENCIA SOFTWARE 50000 EUR',
    allowedQuality: ['PARCIAL'],
    minimumScores: {
        factAccuracy: 1,
        absenceAccuracy: 1,
        evidenceGrounding: 1,
    },
    maxDegradedBlocks: 0,
};

Deno.test('scoreEvaluation acepta hechos exactos, ausencias y citas grounded', () => {
    const output = {
        result: {
            datosGenerales: {
                titulo: { value: 'LICENCIA SOFTWARE', status: 'extraido' },
                presupuesto: { value: 50_000, status: 'extraido' },
                organoContratacion: { value: '', status: 'no_encontrado' },
            },
        },
        workflow: {
            quality: { overall: 'PARCIAL' },
            evidences: [
                { fieldPath: 'titulo', quote: 'LICENCIA SOFTWARE' },
                { fieldPath: 'datosGenerales.presupuesto', quote: '50000 EUR' },
            ],
        },
    };

    const score = scoreEvaluation(output, expectation, { degradedBlocks: [] });

    assertEquals(score.passed, true, 'el caso debe pasar');
    assertEquals(score.metrics.factAccuracy, 1, 'factAccuracy');
    assertEquals(score.metrics.absenceAccuracy, 1, 'absenceAccuracy');
    assertEquals(score.metrics.evidenceGrounding, 1, 'evidenceGrounding');
});

Deno.test('scoreEvaluation falla ante alucinación, cita no grounded y degradación', () => {
    const output = {
        result: {
            datosGenerales: {
                titulo: { value: 'LICENCIA SOFTWARE', status: 'extraido' },
                presupuesto: { value: 75_000, status: 'extraido' },
                organoContratacion: { value: 'Entidad inventada', status: 'extraido' },
            },
        },
        workflow: {
            quality: { overall: 'COMPLETO' },
            evidences: [
                { fieldPath: 'titulo', quote: 'LICENCIA SOFTWARE' },
                { fieldPath: 'datosGenerales.presupuesto', quote: '75000 EUR' },
            ],
        },
    };

    const score = scoreEvaluation(output, expectation, { degradedBlocks: ['economico'] });

    assertEquals(score.passed, false, 'el caso debe fallar');
    assertEquals(score.metrics.factAccuracy, 0.5, 'factAccuracy');
    assertEquals(score.metrics.absenceAccuracy, 0, 'absenceAccuracy');
    assertEquals(score.metrics.evidenceGrounding, 0.5, 'evidenceGrounding');
    assertEquals(score.metrics.qualityMatch, 0, 'qualityMatch');
    assertEquals(score.metrics.degradedBlockCount, 1, 'degradedBlockCount');
});
