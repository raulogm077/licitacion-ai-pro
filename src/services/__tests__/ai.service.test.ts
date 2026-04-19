import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIService, LicitacionAIError } from '../ai.service';
import { jobService } from '../job.service';
import { tf } from '../../test-utils/tracked-field-factory';

// Mock JobService
vi.mock('../job.service', () => ({
    jobService: {
        analyzeWithAgents: vi.fn(),
    },
}));

describe('AIService', () => {
    let service: AIService;
    const mockAnalyze = jobService.analyzeWithAgents as unknown as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AIService();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const validResult = {
        content: {
            datosGenerales: {
                titulo: tf('Test Licitación'),
                presupuesto: tf(50000),
                moneda: tf('EUR'),
                plazoEjecucionMeses: tf(12),
                cpv: tf(['12345678']),
                organoContratacion: tf('Ayuntamiento'),
            },
            criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
            requisitosTecnicos: { funcionales: [], normativa: [] },
            requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 1000 }, tecnica: [], profesional: [] },
            restriccionesYRiesgos: { killCriteria: [], riesgos: [], penalizaciones: [] },
            modeloServicio: { sla: [], equipoMinimo: [] },
        },
        workflow: {},
    };

    // ── Basic invocation ─────────────────────────────────────────────────────

    it('calls jobService.analyzeWithAgents and returns result', async () => {
        mockAnalyze.mockResolvedValue(validResult);

        const onProgress = vi.fn();
        const result = await service.analyzePdfContent('base64data', onProgress, undefined, 'file.pdf', 'hash123');

        expect(result).toBeDefined();
        expect(result.content.datosGenerales.titulo).toEqual(tf('Test Licitación'));
        expect(mockAnalyze).toHaveBeenCalledTimes(1);
    });

    it('throws when filename is missing', async () => {
        await expect(service.analyzePdfContent('base64data')).rejects.toThrow('Filename and Hash are required');
    });

    it('throws when hash is missing', async () => {
        await expect(service.analyzePdfContent('base64data', undefined, undefined, 'file.pdf')).rejects.toThrow(
            'Filename and Hash are required'
        );
    });

    // ── Abort signal ─────────────────────────────────────────────────────────

    it('throws LicitacionAIError when signal is already aborted before call', async () => {
        const controller = new AbortController();
        controller.abort();

        await expect(service.analyzePdfContent('b64', undefined, controller.signal, 'f.pdf', 'h1')).rejects.toThrow(
            LicitacionAIError
        );
    });

    // ── onProgress / event routing ────────────────────────────────────────────

    it('calls onProgress(0, 100, ...) at start', async () => {
        const onProgress = vi.fn();
        mockAnalyze.mockImplementation(async () => validResult);

        await service.analyzePdfContent('b64', onProgress, undefined, 'f.pdf', 'h1');

        expect(onProgress).toHaveBeenCalledWith(0, 100, expect.stringContaining('Iniciando'));
    });

    it('calls onProgress(100, 100, ...) at end', async () => {
        const onProgress = vi.fn();
        mockAnalyze.mockImplementation(async () => validResult);

        await service.analyzePdfContent('b64', onProgress, undefined, 'f.pdf', 'h1');

        expect(onProgress).toHaveBeenLastCalledWith(100, 100, expect.any(String));
    });

    it('handles phase_started event with known phase', async () => {
        const onProgress = vi.fn();
        mockAnalyze.mockImplementation(async (_b64, _fn, _tpl, callback) => {
            callback({ type: 'phase_started', phase: 'ingestion', message: 'Ingesting' });
            return validResult;
        });

        await service.analyzePdfContent('b64', onProgress, undefined, 'f.pdf', 'h1');
        // ingestion starts at 0
        expect(onProgress).toHaveBeenCalledWith(0, 100, 'Ingesting');
    });

    it('handles phase_started with unknown phase (no onProgress call for that event)', async () => {
        const onProgress = vi.fn();
        mockAnalyze.mockImplementation(async (_b64, _fn, _tpl, callback) => {
            callback({ type: 'phase_started', phase: 'unknown_phase' });
            return validResult;
        });

        // Should not throw; unknown phases are silently ignored
        await expect(service.analyzePdfContent('b64', onProgress, undefined, 'f.pdf', 'h1')).resolves.toBeDefined();
    });

    it('handles phase_completed event', async () => {
        const onProgress = vi.fn();
        mockAnalyze.mockImplementation(async (_b64, _fn, _tpl, callback) => {
            callback({ type: 'phase_completed', phase: 'document_map', message: 'Map done' });
            return validResult;
        });

        await service.analyzePdfContent('b64', onProgress, undefined, 'f.pdf', 'h1');
        // document_map ends at 20
        expect(onProgress).toHaveBeenCalledWith(20, 100, 'Map done');
    });

    it('handles extraction_progress event', async () => {
        const onProgress = vi.fn();
        mockAnalyze.mockImplementation(async (_b64, _fn, _tpl, callback) => {
            callback({ type: 'extraction_progress', blockIndex: 3, totalBlocks: 9, message: 'Block 3' });
            return validResult;
        });

        await service.analyzePdfContent('b64', onProgress, undefined, 'f.pdf', 'h1');
        // extraction: 20–80, blockIndex 3/9 → 20 + (3/9)*60 = 40
        expect(onProgress).toHaveBeenCalledWith(40, 100, 'Block 3');
    });

    it('handles phase_progress event at mid-range', async () => {
        const onProgress = vi.fn();
        mockAnalyze.mockImplementation(async (_b64, _fn, _tpl, callback) => {
            callback({ type: 'phase_started', phase: 'consolidation' });
            callback({ type: 'phase_progress', phase: 'consolidation', message: 'Consolidating' });
            return validResult;
        });

        await service.analyzePdfContent('b64', onProgress, undefined, 'f.pdf', 'h1');
        // consolidation: 80–90, mid = 85
        expect(onProgress).toHaveBeenCalledWith(85, 100, 'Consolidating');
    });

    it('handles heartbeat event without calling onProgress for it', async () => {
        const onProgress = vi.fn();
        mockAnalyze.mockImplementation(async (_b64, _fn, _tpl, callback) => {
            callback({ type: 'heartbeat' });
            return validResult;
        });

        await service.analyzePdfContent('b64', onProgress, undefined, 'f.pdf', 'h1');

        // heartbeat alone should not add an onProgress call beyond start/end
        const calls = onProgress.mock.calls;
        const heartbeatCall = calls.find((c) => c[2] === 'heartbeat');
        expect(heartbeatCall).toBeUndefined();
    });

    it('surfaces retry_scheduled events with a visible countdown', async () => {
        vi.useFakeTimers();
        const onProgress = vi.fn();

        mockAnalyze.mockImplementation(async (_b64, _fn, _tpl, callback) => {
            callback({ type: 'phase_started', phase: 'extraction', message: 'Extrayendo información...' });
            callback({
                type: 'retry_scheduled',
                phase: 'extraction',
                blockName: 'datosGenerales',
                attempt: 2,
                maxAttempts: 5,
                waitMs: 3000,
                reason: 'rate_limit',
                blockIndex: 1,
                totalBlocks: 9,
            });
            await new Promise((resolve) => setTimeout(resolve, 3200));
            return validResult;
        });

        const promise = service.analyzePdfContent('b64', onProgress, undefined, 'f.pdf', 'h1');

        await vi.advanceTimersByTimeAsync(2200);

        const messages = onProgress.mock.calls.map(([, , message]) => String(message));
        expect(messages.some((message) => message.includes('datosGenerales') && message.includes('3s'))).toBe(true);
        expect(messages.some((message) => message.includes('2s'))).toBe(true);
        expect(messages.some((message) => message.includes('1s'))).toBe(true);

        await vi.advanceTimersByTimeAsync(1500);
        await promise;
        vi.useRealTimers();
    });

    it('passes files parameter to jobService', async () => {
        mockAnalyze.mockResolvedValue(validResult);
        const files = [{ name: 'annex.pdf', base64: 'abc' }];

        await service.analyzePdfContent('b64', undefined, undefined, 'f.pdf', 'h1', null, files);

        expect(mockAnalyze).toHaveBeenCalledWith('b64', 'f.pdf', null, expect.any(Function), files, undefined);
    });

    // ── Error handling ────────────────────────────────────────────────────────

    it('wraps jobService errors in LicitacionAIError', async () => {
        mockAnalyze.mockRejectedValue(new Error('Upstream failure'));

        const promise = service.analyzePdfContent('b64', undefined, undefined, 'f.pdf', 'h1');

        await expect(promise).rejects.toBeInstanceOf(LicitacionAIError);
        await expect(promise).rejects.toThrow('Upstream failure');
    });

    it('wraps non-Error thrown values', async () => {
        mockAnalyze.mockRejectedValue('string error');

        await expect(service.analyzePdfContent('b64', undefined, undefined, 'f.pdf', 'h1')).rejects.toBeInstanceOf(
            LicitacionAIError
        );
    });
});
