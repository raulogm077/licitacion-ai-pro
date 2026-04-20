import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LicitacionSchema } from '../../src/lib/schemas';
import { buildPliegoVM } from '../../src/features/dashboard/model/pliego-vm';
import type { AnalysisPartialReason } from '../../src/types';

interface BenchmarkCaseExpectation {
    overall: 'COMPLETO' | 'PARCIAL' | 'VACIO';
    guidanceTone?: 'info' | 'warning' | 'success';
    requiredDisplayFields?: Array<'titulo' | 'presupuesto' | 'plazo' | 'organo' | 'cpv' | 'moneda'>;
    undetectedDisplayFields?: Array<'titulo' | 'presupuesto' | 'plazo' | 'organo' | 'cpv' | 'moneda'>;
    requiredSections?: string[];
    requiredPartialReasons?: AnalysisPartialReason[];
}

interface BenchmarkCase {
    id: string;
    description: string;
    fixture: string;
    sourcePdf?: string;
    expected: BenchmarkCaseExpectation;
}

interface BenchmarkManifest {
    version: number;
    cases: BenchmarkCase[];
}

const projectRoot = process.cwd();
const benchmarkDir = path.join(projectRoot, 'benchmarks', 'pliegos');
const manifestPath = path.join(benchmarkDir, 'manifest.json');

function loadManifest(): BenchmarkManifest {
    return JSON.parse(readFileSync(manifestPath, 'utf8')) as BenchmarkManifest;
}

function loadFixture(relativePath: string) {
    const raw = JSON.parse(readFileSync(path.join(benchmarkDir, relativePath), 'utf8'));
    return LicitacionSchema.parse(raw);
}

function validateCase(testCase: BenchmarkCase): string[] {
    const failures: string[] = [];
    const fixture = loadFixture(testCase.fixture);
    const vm = buildPliegoVM(fixture);

    if (testCase.sourcePdf) {
        const sourcePath = path.resolve(benchmarkDir, testCase.sourcePdf);
        if (!existsSync(sourcePath)) {
            failures.push(`sourcePdf no encontrado: ${testCase.sourcePdf}`);
        }
    }

    if (vm.quality.overall !== testCase.expected.overall) {
        failures.push(`overall esperado=${testCase.expected.overall} recibido=${vm.quality.overall}`);
    }

    if (testCase.expected.guidanceTone && vm.guidance?.tone !== testCase.expected.guidanceTone) {
        failures.push(`guidanceTone esperado=${testCase.expected.guidanceTone} recibido=${vm.guidance?.tone || 'none'}`);
    }

    for (const field of testCase.expected.requiredDisplayFields || []) {
        if (vm.display[field] === 'No detectado') {
            failures.push(`display.${field} no debe quedar en "No detectado"`);
        }
    }

    for (const field of testCase.expected.undetectedDisplayFields || []) {
        if (vm.display[field] !== 'No detectado') {
            failures.push(`display.${field} debería quedar en "No detectado"`);
        }
    }

    for (const section of testCase.expected.requiredSections || []) {
        if ((vm.quality.bySection[section] || 'VACIO') === 'VACIO') {
            failures.push(`section ${section} no debe quedar VACIO`);
        }
    }

    for (const reason of testCase.expected.requiredPartialReasons || []) {
        if (!vm.quality.partialReasons.includes(reason)) {
            failures.push(`partial_reason ausente: ${reason}`);
        }
    }

    return failures;
}

function main() {
    const manifest = loadManifest();
    const failures: string[] = [];

    console.log(`Benchmark funcional de pliegos · casos=${manifest.cases.length}`);

    for (const testCase of manifest.cases) {
        const caseFailures = validateCase(testCase);
        if (caseFailures.length === 0) {
            console.log(`PASS ${testCase.id} · ${testCase.description}`);
            continue;
        }

        console.error(`FAIL ${testCase.id} · ${testCase.description}`);
        for (const failure of caseFailures) {
            console.error(`  - ${failure}`);
            failures.push(`${testCase.id}: ${failure}`);
        }
    }

    if (failures.length > 0) {
        console.error(`\nBenchmark funcional fallido (${failures.length} errores).`);
        process.exit(1);
    }

    console.log('\nBenchmark funcional completado.');
}

main();
