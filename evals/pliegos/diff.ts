/**
 * Comparación de dos informes de `pnpm eval:pliegos:live`.
 *
 * Por qué existe: el contrato de release exige una baseline live antes y
 * después de promover modelo, prompt, retrieval u orquestación — pero hasta
 * aquí «comparar» era abrir dos JSON y mirarlos a ojo. Con seis métricas por
 * caso y dos direcciones de bondad distintas (cinco suben, `degradedBlockCount`
 * baja), esa comparación manual es justo donde se cuela una regresión.
 *
 * Dos decisiones que definen el módulo:
 *
 * 1. **Se niega a comparar lo que no es comparable.** Si cambia el dataset o el
 *    conjunto de casos, el diff no se imprime «con una advertencia»: falla. El
 *    README de `evals/` ya lo dice —un cambio de IA no es comparable si cambia
 *    el dataset— y una comparación inválida presentada como válida es peor que
 *    ninguna, porque autoriza una promoción con la firma equivocada.
 *
 * 2. **El fingerprint distinto NO es un impedimento.** Es lo esperado: si el
 *    runtime no hubiera cambiado, no habría nada que promover. Se muestra para
 *    dejar constancia de qué cambió entre las dos ejecuciones.
 *
 * La lógica es pura y se testea sin clave de OpenAI (`diff_test.ts`, dentro de
 * `verify:release`). La E/S vive solo en `main()`.
 */

// ─── Forma de los informes que escribe run.ts ────────────────────────────────

export interface EvalCaseReport {
    id: string;
    description?: string;
    status: 'passed' | 'failed' | 'error';
    durationMs?: number;
    score?: {
        passed: boolean;
        metrics: Record<string, number>;
        failures?: string[];
    };
    error?: string;
}

export interface EvalReport {
    reportVersion: number;
    datasetVersion: string;
    startedAt?: string;
    runtime?: Record<string, unknown>;
    runtimeFingerprint?: string;
    summary?: { total: number; passed: number; failed: number; errors: number };
    cases: EvalCaseReport[];
}

/**
 * Dirección de bondad de cada métrica. `degradedBlockCount` es un recuento de
 * bloques que se degradaron: subir es empeorar. Tratarlo como las demás —«más
 * es mejor»— invertiría el veredicto en la única métrica que mide daño, así que
 * el mapa es explícito y una métrica desconocida se reporta sin veredicto en
 * vez de asumir una dirección.
 */
export const METRIC_DIRECTION: Record<string, 'higher_is_better' | 'lower_is_better'> = {
    schemaValid: 'higher_is_better',
    factAccuracy: 'higher_is_better',
    absenceAccuracy: 'higher_is_better',
    evidenceGrounding: 'higher_is_better',
    qualityMatch: 'higher_is_better',
    degradedBlockCount: 'lower_is_better',
};

/** Ruido de coma flotante: por debajo de esto, dos métricas son la misma. */
const EPSILON = 1e-9;

// ─── Comparabilidad ──────────────────────────────────────────────────────────

export type Comparability = { comparable: true } | { comparable: false; reasons: string[] };

export function assessComparability(base: EvalReport, head: EvalReport): Comparability {
    const reasons: string[] = [];

    if (base.reportVersion !== head.reportVersion) {
        reasons.push(`reportVersion distinto (base ${base.reportVersion}, head ${head.reportVersion})`);
    }
    if (base.datasetVersion !== head.datasetVersion) {
        reasons.push(`datasetVersion distinto (base «${base.datasetVersion}», head «${head.datasetVersion}»)`);
    }

    const baseIds = new Set(base.cases.map((c) => c.id));
    const headIds = new Set(head.cases.map((c) => c.id));
    const soloBase = [...baseIds].filter((id) => !headIds.has(id));
    const soloHead = [...headIds].filter((id) => !baseIds.has(id));
    if (soloBase.length > 0) reasons.push(`casos solo en base: ${soloBase.join(', ')}`);
    if (soloHead.length > 0) reasons.push(`casos solo en head: ${soloHead.join(', ')}`);

    return reasons.length === 0 ? { comparable: true } : { comparable: false, reasons };
}

// ─── Diff ────────────────────────────────────────────────────────────────────

export interface MetricDelta {
    metric: string;
    base: number;
    head: number;
    delta: number;
    verdict: 'mejora' | 'regresion' | 'igual' | 'desconocido';
}

export interface CaseDiff {
    id: string;
    baseStatus: EvalCaseReport['status'];
    headStatus: EvalCaseReport['status'];
    statusVerdict: 'mejora' | 'regresion' | 'igual';
    metrics: MetricDelta[];
    newFailures: string[];
}

export interface ReportDiff {
    runtimeChanged: boolean;
    runtimeBase?: Record<string, unknown>;
    runtimeHead?: Record<string, unknown>;
    fingerprintBase?: string;
    fingerprintHead?: string;
    cases: CaseDiff[];
    regressions: CaseDiff[];
    improvements: CaseDiff[];
}

const STATUS_RANK: Record<EvalCaseReport['status'], number> = { error: 0, failed: 1, passed: 2 };

function compareStatus(base: EvalCaseReport['status'], head: EvalCaseReport['status']): CaseDiff['statusVerdict'] {
    if (STATUS_RANK[head] > STATUS_RANK[base]) return 'mejora';
    if (STATUS_RANK[head] < STATUS_RANK[base]) return 'regresion';
    return 'igual';
}

function diffMetrics(base: Record<string, number>, head: Record<string, number>): MetricDelta[] {
    const names = [...new Set([...Object.keys(base), ...Object.keys(head)])].sort();
    return names.map((metric) => {
        const b = base[metric];
        const h = head[metric];
        const direction = METRIC_DIRECTION[metric];

        // Una métrica que solo existe en uno de los informes, o cuya dirección
        // no está declarada, no recibe veredicto. Inventarlo aquí sería la
        // misma falsa autoridad que el resto del producto evita.
        if (typeof b !== 'number' || typeof h !== 'number' || !direction) {
            return { metric, base: b ?? NaN, head: h ?? NaN, delta: NaN, verdict: 'desconocido' as const };
        }

        const delta = h - b;
        if (Math.abs(delta) < EPSILON) return { metric, base: b, head: h, delta: 0, verdict: 'igual' as const };
        const mejora = direction === 'higher_is_better' ? delta > 0 : delta < 0;
        return { metric, base: b, head: h, delta, verdict: mejora ? ('mejora' as const) : ('regresion' as const) };
    });
}

export function diffReports(base: EvalReport, head: EvalReport): ReportDiff {
    const headById = new Map(head.cases.map((c) => [c.id, c]));

    const cases: CaseDiff[] = base.cases.map((baseCase) => {
        const headCase = headById.get(baseCase.id)!;
        const baseFailures = new Set(baseCase.score?.failures ?? []);

        return {
            id: baseCase.id,
            baseStatus: baseCase.status,
            headStatus: headCase.status,
            statusVerdict: compareStatus(baseCase.status, headCase.status),
            metrics: diffMetrics(baseCase.score?.metrics ?? {}, headCase.score?.metrics ?? {}),
            newFailures: (headCase.score?.failures ?? []).filter((f) => !baseFailures.has(f)),
        };
    });

    // Una regresión es un caso que empeora de estado **o** que, manteniéndolo,
    // empeora alguna métrica. Lo segundo importa tanto como lo primero: un caso
    // sigue en «passed» mientras su exactitud cae hacia el umbral, y ese es
    // exactamente el deterioro que una promoción barata produce antes de romper.
    const isRegression = (c: CaseDiff) =>
        c.statusVerdict === 'regresion' || c.metrics.some((m) => m.verdict === 'regresion');
    const isImprovement = (c: CaseDiff) =>
        !isRegression(c) && (c.statusVerdict === 'mejora' || c.metrics.some((m) => m.verdict === 'mejora'));

    return {
        runtimeChanged: JSON.stringify(base.runtime ?? {}) !== JSON.stringify(head.runtime ?? {}),
        runtimeBase: base.runtime,
        runtimeHead: head.runtime,
        fingerprintBase: base.runtimeFingerprint,
        fingerprintHead: head.runtimeFingerprint,
        cases,
        regressions: cases.filter(isRegression),
        improvements: cases.filter(isImprovement),
    };
}

// ─── Presentación ────────────────────────────────────────────────────────────

function fmt(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(4);
}

export function renderDiff(diff: ReportDiff): string {
    const out: string[] = [];

    out.push('# Comparación de evaluaciones live\n');

    out.push('## Runtime');
    if (!diff.runtimeChanged) {
        out.push('El runtime declarado es idéntico en ambos informes. Si esperabas promover algo, no está aplicado.');
    } else {
        out.push('```diff');
        out.push(`- base: ${JSON.stringify(diff.runtimeBase)}`);
        out.push(`+ head: ${JSON.stringify(diff.runtimeHead)}`);
        out.push('```');
    }
    if (diff.fingerprintBase !== diff.fingerprintHead) {
        out.push(`Fingerprint del runtime: \`${diff.fingerprintBase}\` → \`${diff.fingerprintHead}\`.`);
    }
    out.push('');

    out.push('## Casos\n');
    for (const c of diff.cases) {
        const marca = c.statusVerdict === 'regresion' ? '❌' : c.statusVerdict === 'mejora' ? '✅' : '·';
        out.push(`${marca} **${c.id}** — ${c.baseStatus} → ${c.headStatus}`);
        for (const m of c.metrics) {
            if (m.verdict === 'igual') continue;
            const signo = m.verdict === 'regresion' ? '↓' : m.verdict === 'mejora' ? '↑' : '?';
            out.push(`    ${signo} ${m.metric}: ${fmt(m.base)} → ${fmt(m.head)}`);
        }
        for (const f of c.newFailures) out.push(`    · fallo nuevo: ${f}`);
    }
    out.push('');

    out.push('## Veredicto\n');
    if (diff.regressions.length > 0) {
        out.push(
            `**${diff.regressions.length} caso(s) con regresión**: ${diff.regressions.map((c) => c.id).join(', ')}.`
        );
        out.push('No promover sin explicar por qué esa pérdida es aceptable.');
    } else if (diff.improvements.length > 0) {
        out.push(`Sin regresiones. ${diff.improvements.length} caso(s) mejoran.`);
    } else {
        out.push('Sin regresiones ni mejoras: las dos ejecuciones son equivalentes en métricas.');
    }

    return out.join('\n');
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function readReport(path: string): Promise<EvalReport> {
    try {
        return JSON.parse(await Deno.readTextFile(path)) as EvalReport;
    } catch (error) {
        throw new Error(`No se pudo leer el informe «${path}»: ${error instanceof Error ? error.message : error}`);
    }
}

async function main(): Promise<void> {
    const args = Deno.args.filter((a) => !a.startsWith('-'));
    if (args.length === 0) {
        console.error('Uso: pnpm eval:pliegos:diff -- <baseline.json> [head.json]');
        console.error('Si se omite head.json se usa evals/results/latest.json.');
        Deno.exitCode = 2;
        return;
    }

    const basePath = args[0];
    const headPath = args[1] ?? 'evals/results/latest.json';
    const [base, head] = await Promise.all([readReport(basePath), readReport(headPath)]);

    const comparability = assessComparability(base, head);
    if (!comparability.comparable) {
        console.error('[eval:diff] Estos dos informes NO son comparables:');
        for (const reason of comparability.reasons) console.error(`  · ${reason}`);
        console.error('\nComparar de todos modos daría un veredicto con la firma equivocada. Repite la baseline.');
        Deno.exitCode = 2;
        return;
    }

    const diff = diffReports(base, head);
    console.log(renderDiff(diff));
    if (diff.regressions.length > 0) Deno.exitCode = 1;
}

if (import.meta.main) await main();
