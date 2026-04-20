import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const RELEASE_CONTRACT_BLOCK = 'release-contract';

function isTestLikeFile(file: string): boolean {
    return (
        file.includes('__tests__') ||
        file.endsWith('.test.ts') ||
        file.endsWith('.test.tsx') ||
        file.endsWith('_test.ts')
    );
}

const MIRRORED_BLOCKS = [
    {
        id: RELEASE_CONTRACT_BLOCK,
        files: ['AGENTS.md', 'CLAUDE.md', 'README.md', 'DEPLOYMENT.md'],
    },
] as const;

const DOC_IMPACT_RULES = [
    {
        name: 'release-operations',
        matches: (file: string) =>
            file === 'package.json' ||
            file === 'pnpm-lock.yaml' ||
            file === 'vercel.json' ||
            file === 'playwright.config.ts' ||
            file === 'vite.config.ts' ||
            file.startsWith('.github/workflows/') ||
            file.startsWith('.husky/') ||
            file.startsWith('scripts/'),
        requiredDocs: ['README.md', 'DEPLOYMENT.md', 'AGENTS.md', 'CLAUDE.md'],
    },
    {
        name: 'analysis-runtime',
        matches: (file: string) =>
            !isTestLikeFile(file) &&
            (file.startsWith('supabase/functions/analyze-with-agents/') ||
                file.startsWith('supabase/functions/_shared/') ||
                file === 'src/services/job.service.ts' ||
                file === 'src/services/ai.service.ts' ||
                file === 'src/stores/analysis.store.ts' ||
                file.startsWith('src/features/upload/')),
        requiredDocs: ['ARCHITECTURE.md', 'SPEC.md', 'TECHNICAL_DOCS.md'],
    },
    {
        name: 'backend-contracts',
        matches: (file: string) =>
            file.startsWith('supabase/migrations/') ||
            (!isTestLikeFile(file) && file.startsWith('supabase/functions/chat-with-analysis-agent/')),
        requiredDocs: ['DEPLOYMENT.md', 'SPEC.md', 'TECHNICAL_DOCS.md'],
    },
    {
        name: 'user-facing-behavior',
        matches: (file: string) =>
            file.startsWith('src/') &&
            !file.includes('__tests__') &&
            !file.endsWith('.test.ts') &&
            !file.endsWith('.test.tsx'),
        requiredDocs: ['SPEC.md'],
    },
    {
        name: 'functional-benchmark',
        matches: (file: string) => file.startsWith('benchmarks/'),
        requiredDocs: ['SPEC.md', 'DEPLOYMENT.md', 'README.md'],
    },
];

function run(command: string, args: string[], options: { allowFailure?: boolean } = {}): string {
    const result = spawnSync(command, args, {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.status !== 0 && !options.allowFailure) {
        const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
        throw new Error(output || `Command failed: ${command} ${args.join(' ')}`);
    }

    return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

function git(args: string[], options: { allowFailure?: boolean } = {}): string {
    return run('git', args, options);
}

function revisionExists(revision: string): boolean {
    try {
        git(['rev-parse', '--verify', revision]);
        return true;
    } catch {
        return false;
    }
}

function resolveDiffBase(): string | null {
    const explicitBase = process.env.VERIFY_DIFF_BASE?.trim();
    if (explicitBase) return explicitBase;

    const githubBaseRef = process.env.GITHUB_BASE_REF?.trim();
    if (githubBaseRef && revisionExists(`origin/${githubBaseRef}`)) {
        return git(['merge-base', 'HEAD', `origin/${githubBaseRef}`]).trim();
    }

    const currentBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (currentBranch === 'main' && revisionExists('HEAD~1')) {
        return 'HEAD~1';
    }

    if (revisionExists('origin/main')) {
        return git(['merge-base', 'HEAD', 'origin/main']).trim();
    }

    if (revisionExists('main')) {
        return git(['merge-base', 'HEAD', 'main']).trim();
    }

    if (revisionExists('HEAD~1')) {
        return 'HEAD~1';
    }

    return null;
}

function getChangedFiles(): string[] {
    const base = resolveDiffBase();
    if (!base) {
        return [];
    }

    const output = git(['diff', '--name-only', `${base}...HEAD`], { allowFailure: true });
    return output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

function extractMirroredBlock(content: string, id: string): string {
    const pattern = new RegExp(`<!-- ${id}:start -->([\\s\\S]*?)<!-- ${id}:end -->`, 'm');
    const match = content.match(pattern);
    if (!match) {
        throw new Error(`Missing mirrored block "${id}"`);
    }
    return match[1].trim();
}

function validateMirroredBlocks(): void {
    for (const block of MIRRORED_BLOCKS) {
        const [referenceFile, ...otherFiles] = block.files;
        const referenceContent = readFileSync(path.join(process.cwd(), referenceFile), 'utf8');
        const referenceBlock = extractMirroredBlock(referenceContent, block.id);

        for (const targetFile of otherFiles) {
            const targetContent = readFileSync(path.join(process.cwd(), targetFile), 'utf8');
            const targetBlock = extractMirroredBlock(targetContent, block.id);
            if (targetBlock !== referenceBlock) {
                throw new Error(
                    `Mirrored block "${block.id}" is out of sync between ${referenceFile} and ${targetFile}.`
                );
            }
        }
    }
}

function validateWorkflowSyntax(): void {
    const workflowDir = path.join(process.cwd(), '.github', 'workflows');
    if (!existsSync(workflowDir)) return;

    const workflowFiles = readdirSync(workflowDir)
        .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
        .map((file) => path.join('.github', 'workflows', file));

    if (workflowFiles.length === 0) return;

    const localPrettier = path.join(process.cwd(), 'node_modules', '.bin', 'prettier');
    if (existsSync(localPrettier)) {
        run(localPrettier, ['--check', ...workflowFiles]);
        return;
    }

    execFileSync('pnpm', ['exec', 'prettier', '--check', ...workflowFiles], {
        cwd: process.cwd(),
        stdio: 'pipe',
        encoding: 'utf8',
    });
}

function validateShellSyntax(): void {
    const files: string[] = [];

    const scriptsDir = path.join(process.cwd(), 'scripts');
    if (existsSync(scriptsDir)) {
        for (const entry of readdirSync(scriptsDir)) {
            if (entry.endsWith('.sh')) {
                files.push(path.join('scripts', entry));
            }
        }
    }

    const huskyDir = path.join(process.cwd(), '.husky');
    if (existsSync(huskyDir)) {
        for (const entry of readdirSync(huskyDir)) {
            if (entry === '_' || entry.startsWith('.')) continue;
            const fullPath = path.join(huskyDir, entry);
            if (statSync(fullPath).isFile()) {
                files.push(path.join('.husky', entry));
            }
        }
    }

    for (const file of files) {
        const content = readFileSync(path.join(process.cwd(), file), 'utf8');
        const shell = content.startsWith('#!/bin/bash') || content.startsWith('#!/usr/bin/env bash') ? 'bash' : 'sh';
        run(shell, ['-n', file]);
    }
}

function parseMigrationList(output: string): Array<{ local: string; remote: string }> {
    return output
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.includes('|') && !line.startsWith('Local') && !line.startsWith('---'))
        .map((line) => line.split('|').map((part) => part.trim()))
        .filter((parts) => parts.length >= 2)
        .map(([local, remote]) => ({ local, remote }))
        .filter(({ local, remote }) => /^\d+$/.test(local) || /^\d+$/.test(remote));
}

function validateRemoteMigrationHistory(): void {
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    if (!existsSync(migrationsDir)) return;

    const projectRefFile = path.join(process.cwd(), 'supabase', '.temp', 'project-ref');
    if (!existsSync(projectRefFile)) return;

    const dbPassword = process.env.SUPABASE_DB_PASSWORD?.trim();
    if (!dbPassword) {
        if (process.env.CI) {
            throw new Error('SUPABASE_DB_PASSWORD is required in CI to validate remote migration drift.');
        }
        console.warn('[verify:integrity] Skipping remote migration drift check (SUPABASE_DB_PASSWORD not set).');
        return;
    }

    const output = run('supabase', ['migration', 'list', '--linked', '--password', dbPassword]);
    const rows = parseMigrationList(output);

    if (rows.length === 0) {
        throw new Error('Could not parse remote migration history from "supabase migration list".');
    }

    const driftRows = rows.filter(({ local, remote }) => Boolean(remote) && local !== remote);
    if (driftRows.length > 0) {
        const details = driftRows.map(({ local, remote }) => `local=${local || '(missing)'} remote=${remote}`).join(', ');
        throw new Error(`Remote migration history drifts from the repo: ${details}`);
    }
}

function validateDocumentationCoverage(changedFiles: string[]): void {
    const requiredDocs = new Set<string>();
    const triggeredRules: string[] = [];

    for (const rule of DOC_IMPACT_RULES) {
        if (changedFiles.some((file) => rule.matches(file))) {
            triggeredRules.push(rule.name);
            for (const doc of rule.requiredDocs) {
                requiredDocs.add(doc);
            }
        }
    }

    if (requiredDocs.size === 0) return;

    const missingDocs = [...requiredDocs].filter((doc) => !changedFiles.includes(doc));
    if (missingDocs.length > 0) {
        throw new Error(
            `Critical changes require documentation updates. Rules: ${triggeredRules.join(', ')}. Missing: ${missingDocs.join(', ')}`
        );
    }
}

function validateBenchmarkFixtures(): void {
    const manifestPath = path.join(process.cwd(), 'benchmarks', 'pliegos', 'manifest.json');
    if (!existsSync(manifestPath)) return;

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        cases?: Array<{ id?: string; fixture?: string; sourcePdf?: string }>;
    };

    if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
        throw new Error('benchmarks/pliegos/manifest.json must declare at least one benchmark case.');
    }

    for (const benchmarkCase of manifest.cases) {
        if (!benchmarkCase.id || !benchmarkCase.fixture) {
            throw new Error('Each benchmark case must include both "id" and "fixture".');
        }

        const fixturePath = path.join(process.cwd(), 'benchmarks', 'pliegos', benchmarkCase.fixture);
        if (!existsSync(fixturePath)) {
            throw new Error(`Missing benchmark fixture for case "${benchmarkCase.id}": ${benchmarkCase.fixture}`);
        }

        if (benchmarkCase.sourcePdf) {
            const sourcePdfPath = path.resolve(path.join(process.cwd(), 'benchmarks', 'pliegos'), benchmarkCase.sourcePdf);
            if (!existsSync(sourcePdfPath)) {
                throw new Error(`Missing benchmark sourcePdf for case "${benchmarkCase.id}": ${benchmarkCase.sourcePdf}`);
            }
        }
    }
}

function main(): void {
    const changedFiles = getChangedFiles();

    validateMirroredBlocks();
    validateWorkflowSyntax();
    validateShellSyntax();
    validateBenchmarkFixtures();
    validateRemoteMigrationHistory();
    validateDocumentationCoverage(changedFiles);

    console.log('[verify:integrity] OK');
}

main();
