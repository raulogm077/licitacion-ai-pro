import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAnalysisStore } from '../analysis.store';

// Mock dependencies
vi.mock('../licitacion.store', () => ({
    useLicitacionStore: {
        getState: vi.fn(() => ({
            loadLicitacion: vi.fn(),
            reset: vi.fn(),
            hash: null,
        })),
    },
}));

vi.mock('../../lib/file-utils', () => ({
    processFile: vi.fn(),
}));

vi.mock('../../config/service-registry', () => ({
    services: {
        ai: { analyzePdfContent: vi.fn() },
        db: { saveLicitacion: vi.fn() },
    },
}));

vi.mock('../../services/template.service', () => ({
    templateService: {
        getTemplate: vi.fn(),
    },
}));

vi.mock('../../services/logger', () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('Analysis Store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAnalysisStore.setState({
            status: 'IDLE',
            progress: 0,
            thinkingOutput: '',
            error: null,
            persistenceWarning: null,
            abortController: null,
            selectedTemplateId: null,
            currentPhase: null,
        });
    });

    it('should update state immediately on cancellation (TC-UI-02)', () => {
        useAnalysisStore.setState({ status: 'ANALYZING', abortController: new AbortController() });
        expect(useAnalysisStore.getState().status).toBe('ANALYZING');

        useAnalysisStore.getState().cancelAnalysis();

        expect(useAnalysisStore.getState().status).toBe('IDLE');
        expect(useAnalysisStore.getState().error).toBeNull();
        expect(useAnalysisStore.getState().abortController).toBeNull();
    });

    it('should set template id', () => {
        useAnalysisStore.getState().setTemplateId('123');
        expect(useAnalysisStore.getState().selectedTemplateId).toBe('123');
    });

    it('should clear template id on reset', () => {
        useAnalysisStore.getState().setTemplateId('123');
        useAnalysisStore.getState().resetAnalysis();
        expect(useAnalysisStore.getState().selectedTemplateId).toBe(null);
    });

    it('should reset all state on resetAnalysis', () => {
        useAnalysisStore.setState({
            status: 'ERROR',
            progress: 50,
            thinkingOutput: 'some output',
            error: 'some error',
            persistenceWarning: 'warning',
            abortController: new AbortController(),
            selectedTemplateId: 'tpl-1',
        });

        useAnalysisStore.getState().resetAnalysis();

        const state = useAnalysisStore.getState();
        expect(state.status).toBe('IDLE');
        expect(state.progress).toBe(0);
        expect(state.thinkingOutput).toBe('');
        expect(state.error).toBeNull();
        expect(state.persistenceWarning).toBeNull();
        expect(state.abortController).toBeNull();
        expect(state.selectedTemplateId).toBeNull();
    });

    it('should abort active controller on resetAnalysis', () => {
        const controller = new AbortController();
        const abortSpy = vi.spyOn(controller, 'abort');
        useAnalysisStore.setState({ abortController: controller });

        useAnalysisStore.getState().resetAnalysis();

        expect(abortSpy).toHaveBeenCalled();
    });

    it('should not abort if no controller on cancel', () => {
        useAnalysisStore.setState({ abortController: null, status: 'ANALYZING' });

        useAnalysisStore.getState().cancelAnalysis();
        expect(useAnalysisStore.getState().status).toBe('ANALYZING'); // unchanged since no controller
    });

    it('should handle analyzeFiles with empty array', async () => {
        await useAnalysisStore.getState().analyzeFiles([]);
        expect(useAnalysisStore.getState().status).toBe('IDLE');
    });

    it('should reject oversized files', async () => {
        const { processFile } = await import('../../lib/file-utils');
        vi.mocked(processFile).mockResolvedValue({ hash: 'h1', base64: 'b64', isValidPdf: true });

        const largeFile = new File([new ArrayBuffer(100)], 'large.pdf', { type: 'application/pdf' });
        Object.defineProperty(largeFile, 'size', { value: 200 * 1024 * 1024 }); // 200MB

        await useAnalysisStore.getState().analyzeFiles([largeFile]);

        expect(useAnalysisStore.getState().status).toBe('ERROR');
        expect(useAnalysisStore.getState().error).toContain('tamaño máximo');
    });

    it('should reject invalid PDF', async () => {
        const { processFile } = await import('../../lib/file-utils');
        vi.mocked(processFile).mockResolvedValue({ hash: 'h1', base64: 'b64', isValidPdf: false });

        const file = new File([new ArrayBuffer(10)], 'test.pdf', { type: 'application/pdf' });

        await useAnalysisStore.getState().analyzeFiles([file]);

        expect(useAnalysisStore.getState().status).toBe('ERROR');
        expect(useAnalysisStore.getState().error).toContain('PDF válido');
    });

    it('should handle network/CORS errors', async () => {
        const { processFile } = await import('../../lib/file-utils');
        vi.mocked(processFile).mockRejectedValue(new TypeError('Failed to fetch'));

        const file = new File([new ArrayBuffer(10)], 'test.pdf', { type: 'application/pdf' });

        await useAnalysisStore.getState().analyzeFiles([file]);

        expect(useAnalysisStore.getState().status).toBe('ERROR');
        expect(useAnalysisStore.getState().error).toContain('conexión');
    });

    it('should handle abort/cancel during analysis', async () => {
        const { processFile } = await import('../../lib/file-utils');
        const abortError = new Error('Cancelado por el usuario');
        abortError.name = 'AbortError';
        vi.mocked(processFile).mockRejectedValue(abortError);

        const file = new File([new ArrayBuffer(10)], 'test.pdf', { type: 'application/pdf' });
        await useAnalysisStore.getState().analyzeFiles([file]);

        expect(useAnalysisStore.getState().status).toBe('IDLE');
        expect(useAnalysisStore.getState().error).toBeNull();
    });

    it('should handle generic errors', async () => {
        const { processFile } = await import('../../lib/file-utils');
        vi.mocked(processFile).mockRejectedValue(new Error('Something unexpected'));

        const file = new File([new ArrayBuffer(10)], 'test.pdf', { type: 'application/pdf' });
        await useAnalysisStore.getState().analyzeFiles([file]);

        expect(useAnalysisStore.getState().status).toBe('ERROR');
        expect(useAnalysisStore.getState().error).toBe('Something unexpected');
    });

    it('should handle timeout errors', async () => {
        const { processFile } = await import('../../lib/file-utils');
        vi.mocked(processFile).mockRejectedValue(new Error('Tiempo de espera agotado'));

        const file = new File([new ArrayBuffer(10)], 'test.pdf', { type: 'application/pdf' });
        await useAnalysisStore.getState().analyzeFiles([file]);

        expect(useAnalysisStore.getState().status).toBe('ERROR');
        expect(useAnalysisStore.getState().error).toContain('no respondió');
    });

    it('should complete analysis successfully and set COMPLETED status', async () => {
        const { processFile } = await import('../../lib/file-utils');
        const { services } = await import('../../config/service-registry');

        vi.mocked(processFile).mockResolvedValue({ hash: 'h1', base64: 'b64', isValidPdf: true });
        vi.mocked(services.ai.analyzePdfContent).mockResolvedValue({
            content: {
                datosGenerales: {} as never,
                criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
                requisitosTecnicos: { funcionales: [], normativa: [] },
                requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [], profesional: [] },
                restriccionesYRiesgos: { riesgos: [], killCriteria: [], penalizaciones: [] },
                modeloServicio: { sla: [], equipoMinimo: [] },
            },
            workflow: {},
        } as never);
        vi.mocked(services.db.saveLicitacion).mockResolvedValue({ ok: true } as never);

        const file = new File([new ArrayBuffer(10)], 'test.pdf', { type: 'application/pdf' });
        await useAnalysisStore.getState().analyzeFiles([file]);

        expect(useAnalysisStore.getState().status).toBe('COMPLETED');
        expect(useAnalysisStore.getState().progress).toBe(100);
    });

    it('should set persistenceWarning when DB save fails after successful analysis', async () => {
        const { processFile } = await import('../../lib/file-utils');
        const { services } = await import('../../config/service-registry');

        vi.mocked(processFile).mockResolvedValue({ hash: 'h1', base64: 'b64', isValidPdf: true });
        vi.mocked(services.ai.analyzePdfContent).mockResolvedValue({
            content: {
                datosGenerales: {} as never,
                criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
                requisitosTecnicos: { funcionales: [], normativa: [] },
                requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [], profesional: [] },
                restriccionesYRiesgos: { riesgos: [], killCriteria: [], penalizaciones: [] },
                modeloServicio: { sla: [], equipoMinimo: [] },
            },
            workflow: {},
        } as never);
        vi.mocked(services.db.saveLicitacion).mockResolvedValue({
            ok: false,
            error: new Error('DB connection failed'),
        } as never);

        const file = new File([new ArrayBuffer(10)], 'test.pdf', { type: 'application/pdf' });
        await useAnalysisStore.getState().analyzeFiles([file]);

        expect(useAnalysisStore.getState().persistenceWarning).toContain('DB connection failed');
    });
});
