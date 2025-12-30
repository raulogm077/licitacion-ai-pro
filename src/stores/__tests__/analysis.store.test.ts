import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAnalysisStore } from '../analysis.store';

// Mock dependencies
vi.mock('../../services/sse-client', () => ({
    analyzeWithSSE: vi.fn()
}));

// Mock LicitacionStore if needed (it is used in analyzeFile)
vi.mock('../licitacion.store', () => ({
    useLicitacionStore: {
        getState: vi.fn(() => ({
            loadLicitacion: vi.fn(),
            reset: vi.fn(),
            hash: null
        }))
    }
}));

describe('Analysis Store (TC-UI)', () => {

    beforeEach(() => {
        // Reset store state
        useAnalysisStore.setState({
            status: 'IDLE',
            progress: 0,
            thinkingOutput: '',
            error: null,
            selectedProvider: 'openai',
            readingMode: 'full'
        });
    });



    it('should persist provider and reading mode selection (TC-UI-01)', () => {
        // Act: Change settings
        useAnalysisStore.getState().setProvider('gemini');
        useAnalysisStore.getState().setReadingMode('keydata');

        // Assert: State updated
        expect(useAnalysisStore.getState().selectedProvider).toBe('gemini');
        expect(useAnalysisStore.getState().readingMode).toBe('keydata');
    });

    it('should update state immediately on cancellation (TC-UI-02)', () => {
        // Setup: Running state
        useAnalysisStore.setState({ status: 'ANALYZING', abortController: new AbortController() });
        expect(useAnalysisStore.getState().status).toBe('ANALYZING');

        // Act: Cancel
        useAnalysisStore.getState().cancelAnalysis();

        // Assert: State is idle
        expect(useAnalysisStore.getState().status).toBe('IDLE');
        expect(useAnalysisStore.getState().error).toBeNull();
        expect(useAnalysisStore.getState().abortController).toBeNull();
    });

    it('should set reading mode correctly', () => {
        expect(useAnalysisStore.getState().readingMode).toBe('full'); // Default after reset

        useAnalysisStore.getState().setReadingMode('keydata');

        expect(useAnalysisStore.getState().readingMode).toBe('keydata');
    });
});
