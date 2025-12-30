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
            selectedProvider: 'openai'
        });
    });



    it('should persist provider selection (TC-UI-01)', () => {
        // Act: Change settings
        useAnalysisStore.getState().setProvider('gemini');

        // Assert: State updated
        expect(useAnalysisStore.getState().selectedProvider).toBe('gemini');
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


});
