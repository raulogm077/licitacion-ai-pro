/**
 * Contrato de la comparación de evaluaciones live.
 *
 * Estos tests existen porque `diff.ts` es lo que decide si una promoción de
 * modelo se autoriza, y esa decisión no puede depender de una ejecución con
 * clave de OpenAI. Todo lo comprobable sin clave se comprueba sin clave.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { assessComparability, diffReports, renderDiff, METRIC_DIRECTION, type EvalReport } from './diff.ts';

function report(overrides: Partial<EvalReport> = {}): EvalReport {
    return {
        reportVersion: 1,
        datasetVersion: 'v1',
        runtime: { model: 'gpt-4.1' },
        runtimeFingerprint: 'aaa',
        cases: [
            {
                id: 'memo-p2-live',
                status: 'passed',
                score: {
                    passed: true,
                    metrics: {
                        schemaValid: 1,
                        factAccuracy: 0.9,
                        absenceAccuracy: 1,
                        evidenceGrounding: 0.8,
                        qualityMatch: 1,
                        degradedBlockCount: 0,
                    },
                    failures: [],
                },
            },
        ],
        ...overrides,
    };
}

// ─── Comparabilidad ──────────────────────────────────────────────────────────

Deno.test('dos informes del mismo dataset y casos son comparables', () => {
    assertEquals(assessComparability(report(), report()), { comparable: true });
});

Deno.test('un dataset distinto invalida la comparación', () => {
    const result = assessComparability(report(), report({ datasetVersion: 'v2' }));
    assert(!result.comparable);
    assert(result.reasons.some((r) => r.includes('datasetVersion')));
});

Deno.test('un conjunto de casos distinto invalida la comparación', () => {
    // El caso realista: alguien añade un caso al dataset entre la baseline y la
    // segunda pasada. Los agregados dejan de significar lo mismo y compararlos
    // daría un veredicto con la firma equivocada.
    const head = report({
        cases: [...report().cases, { id: 'caso-nuevo', status: 'passed', score: { passed: true, metrics: {} } }],
    });
    const result = assessComparability(report(), head);
    assert(!result.comparable);
    assert(result.reasons.some((r) => r.includes('caso-nuevo')));
});

Deno.test('un reportVersion distinto invalida la comparación', () => {
    const result = assessComparability(report(), report({ reportVersion: 2 }));
    assert(!result.comparable);
    assert(result.reasons.some((r) => r.includes('reportVersion')));
});

// ─── Dirección de las métricas ───────────────────────────────────────────────

Deno.test('degradedBlockCount es la única métrica donde bajar es mejorar', () => {
    // Si alguien añade una métrica de daño nueva y la deja fuera del mapa, o la
    // declara como las demás, el veredicto se invierte justo donde importa.
    const lowerIsBetter = Object.entries(METRIC_DIRECTION)
        .filter(([, dir]) => dir === 'lower_is_better')
        .map(([name]) => name);
    assertEquals(lowerIsBetter, ['degradedBlockCount']);
});

Deno.test('subir degradedBlockCount es regresión, no mejora', () => {
    const head = report();
    head.cases[0].score!.metrics.degradedBlockCount = 2;
    const diff = diffReports(report(), head);
    assertEquals(
        diff.regressions.map((c) => c.id),
        ['memo-p2-live']
    );
    assertEquals(diff.cases[0].metrics.find((m) => m.metric === 'degradedBlockCount')?.verdict, 'regresion');
});

Deno.test('bajar factAccuracy es regresión aunque el caso siga en passed', () => {
    // El deterioro que una promoción barata produce ANTES de romper: el caso
    // sigue pasando mientras su exactitud cae hacia el umbral. Si esto no
    // contara como regresión, el diff daría luz verde a la degradación.
    const head = report();
    head.cases[0].score!.metrics.factAccuracy = 0.75;
    const diff = diffReports(report(), head);
    assertEquals(diff.cases[0].statusVerdict, 'igual');
    assertEquals(diff.regressions.length, 1);
});

Deno.test('una métrica sin dirección declarada no recibe veredicto', () => {
    const base = report();
    const head = report();
    base.cases[0].score!.metrics.metricaNueva = 1;
    head.cases[0].score!.metrics.metricaNueva = 5;
    const diff = diffReports(base, head);
    const delta = diff.cases[0].metrics.find((m) => m.metric === 'metricaNueva');
    assertEquals(delta?.verdict, 'desconocido');
    assertEquals(diff.regressions.length, 0);
    assertEquals(diff.improvements.length, 0);
});

// ─── Estado y agregados ──────────────────────────────────────────────────────

Deno.test('passed → failed es regresión; failed → passed es mejora', () => {
    const head = report();
    head.cases[0].status = 'failed';
    assertEquals(diffReports(report(), head).cases[0].statusVerdict, 'regresion');

    const base = report();
    base.cases[0].status = 'error';
    assertEquals(diffReports(base, report()).cases[0].statusVerdict, 'mejora');
});

Deno.test('un caso que mejora y regresa a la vez cuenta como regresión', () => {
    // Una mejora no compensa una pérdida: quien promueve tiene que mirar la
    // pérdida y decidir, no ver un neto que la esconde.
    const head = report();
    head.cases[0].score!.metrics.factAccuracy = 1;
    head.cases[0].score!.metrics.evidenceGrounding = 0.5;
    const diff = diffReports(report(), head);
    assertEquals(diff.regressions.length, 1);
    assertEquals(diff.improvements.length, 0);
});

Deno.test('dos ejecuciones idénticas no producen ni regresiones ni mejoras', () => {
    const diff = diffReports(report(), report());
    assertEquals(diff.regressions.length, 0);
    assertEquals(diff.improvements.length, 0);
    assertEquals(diff.runtimeChanged, false);
});

Deno.test('los fallos nuevos se listan y los preexistentes no', () => {
    const base = report();
    base.cases[0].score!.failures = ['fallo viejo'];
    const head = report();
    head.cases[0].score!.failures = ['fallo viejo', 'fallo nuevo'];
    assertEquals(diffReports(base, head).cases[0].newFailures, ['fallo nuevo']);
});

// ─── Presentación ────────────────────────────────────────────────────────────

Deno.test('el render avisa cuando el runtime no cambió', () => {
    // Escenario real: se rellena BLOCK_MODEL_OVERRIDES pero se evalúa sin
    // desplegarlo. Los dos informes salen iguales y sin este aviso se leería
    // como «no hay regresión», que es la conclusión opuesta a la verdadera.
    const salida = renderDiff(diffReports(report(), report()));
    assert(salida.includes('idéntico'));
});

Deno.test('el render nombra los casos con regresión y desaconseja promover', () => {
    const head = report();
    head.cases[0].status = 'failed';
    const salida = renderDiff(diffReports(report(), head));
    assert(salida.includes('memo-p2-live'));
    assert(salida.includes('No promover'));
});

Deno.test('el render muestra el cambio de runtime cuando lo hay', () => {
    const head = report({ runtime: { model: 'gpt-4.1', blockModels: { anexosYObservaciones: 'gpt-4.1-mini' } } });
    const salida = renderDiff(diffReports(report(), head));
    assert(salida.includes('blockModels'));
});
