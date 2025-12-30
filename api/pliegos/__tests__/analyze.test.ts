import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../analyze';
import * as OpenAIRunner from '../../_lib/openaiWorkflow/runner';
// import { services } from '../../../src/config/service-registry';

// Mock Dependencies
vi.mock('../../_lib/openaiWorkflow/runner', () => ({
    runWorkflow: vi.fn()
}));

// Mock Supabase Auth
vi.mock('../../../src/config/supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: 'test-user' } },
                error: null
            })
        }
    }
}));

// Mock DB Persistence
vi.mock('../../../src/services/db.service', () => ({
    dbService: {
        saveLicitacion: vi.fn().mockResolvedValue({ ok: true })
    }
}));

// Mock Gemini Provider interaction
vi.mock('../../../src/config/service-registry', () => ({
    services: {
        ai: {
            analyzePdfContent: vi.fn()
        },
        db: {
            saveLicitacion: vi.fn().mockResolvedValue({ ok: true })
        }
    }
}));

// Helper to create Vercel-like Request/Response objects for testing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockReqRes(body: any, method = 'POST') {
    const req = {
        method,
        headers: {
            authorization: 'Bearer test-token'
        },
        body
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    return { req, res };
}

describe('API Endpoint Logic (TC-API)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default mocks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (OpenAIRunner.runWorkflow as any).mockResolvedValue({ datosGenerales: { titulo: "OpenAI Result" } });
    });

    it('should route to OpenAI Runner when provider is "openai" (TC-API-01)', async () => {
        const { req, res } = createMockReqRes({
            provider: 'openai',
            readingMode: 'full',
            hash: 'abc',
            pdfBase64: 'base64',
            filename: 'test.pdf'
        });

        // Set env vars
        vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
        vi.stubEnv('OPENAI_API_KEY', 'sk-test');

        await handler(req, res);

        // Assert OpenAI runner was called
        expect(OpenAIRunner.runWorkflow).toHaveBeenCalled();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const callArgs = (OpenAIRunner.runWorkflow as any).mock.calls[0][0];
        expect(callArgs.readingMode).toBe('full');
        expect(callArgs.pdfBase64).toBe('base64');
    });

    it('should return error if method is not POST', async () => {
        const { req, res } = createMockReqRes({}, 'GET');

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
    });
});

