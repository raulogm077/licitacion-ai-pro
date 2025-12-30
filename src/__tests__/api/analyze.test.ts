import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../../../api/pliegos/analyze';
import * as OpenAIRunner from '../../../api/_lib/openaiWorkflow/runner';

// Mock Runner
vi.mock('../../../api/_lib/openaiWorkflow/runner', () => ({
    runWorkflow: vi.fn()
}));

// Mock Mapper
vi.mock('../../../api/_lib/mappers/openai-workflow-mapper', () => ({
    mapWorkflowToLicitacionData: vi.fn(val => val)
}));

// Mock Supabase Client (used inside handler)
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
const mockGetUser = vi.fn().mockResolvedValue({
    data: { user: { id: 'test-user', email: 'test@example.com' } },
    error: null
});

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: { getUser: mockGetUser },
        from: mockFrom
    }))
}));

// Mock Request/Response Helpers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockRequest(body: any) {
    return {
        method: 'POST',
        headers: {
            authorization: 'Bearer test-token'
        },
        body
    };
}

function createMockResponse() {
    return {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        write: vi.fn(),
        end: vi.fn()
    };
}

describe('API Endpoint Logic (TC-API)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Setup Env Vars
        vi.stubEnv('VITE_SUPABASE_URL', 'https://mock.supabase.co');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'mock-key');
        vi.stubEnv('OPENAI_API_KEY', 'sk-mock');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (OpenAIRunner.runWorkflow as any).mockResolvedValue({ datosGenerales: { titulo: "OpenAI Result" } });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('should route to OpenAI Runner when provider is "openai" (TC-API-01)', async () => {
        const req = createMockRequest({
            provider: 'openai',
            readingMode: 'full',
            hash: 'abc',
            pdfBase64: 'base64',
            filename: 'test.pdf'
        });
        const res = createMockResponse();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handler(req as any, res as any);

        // Assert OpenAI runner was called
        expect(OpenAIRunner.runWorkflow).toHaveBeenCalled();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const callArgs = (OpenAIRunner.runWorkflow as any).mock.calls[0][0];
        expect(callArgs.readingMode).toBe('full');
        expect(callArgs.pdfBase64).toBe('base64');
    });

    it('should return error for Gemini provider as it is not implemented server-side (TC-API-01)', async () => {
        const req = createMockRequest({
            provider: 'gemini',
            readingMode: 'keydata',
            hash: 'abc',
            pdfBase64: 'base64',
            filename: 'test.pdf'
        });
        const res = createMockResponse();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handler(req as any, res as any);

        // Check for GEMINI_NOT_IMPLEMENTED error in SSE stream
        // The handler writes: event: error ... code: GEMINI_NOT_IMPLEMENTED
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const writeCalls = (res.write as any).mock.calls.map((c: any) => c[0]).join('');
        expect(writeCalls).toContain('GEMINI_NOT_IMPLEMENTED');
        expect(OpenAIRunner.runWorkflow).not.toHaveBeenCalled();
    });

    it('should propagate readingMode to OpenAI Runner (TC-API-02)', async () => {
        const req = createMockRequest({
            provider: 'openai',
            readingMode: 'keydata',
            hash: 'abc',
            pdfBase64: 'base64'
        });
        const res = createMockResponse();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handler(req as any, res as any);

        expect(OpenAIRunner.runWorkflow).toHaveBeenCalledWith(
            expect.objectContaining({ readingMode: 'keydata' }),
            expect.anything()
        );
    });
});
