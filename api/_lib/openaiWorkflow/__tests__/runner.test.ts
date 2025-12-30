
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runWorkflow } from '../runner';

// Hoist mocks to ensure they are available before imports
const mocks = vi.hoisted(() => {
    return {
        // OpenAI
        filesCreate: vi.fn(),
        filesDel: vi.fn().mockResolvedValue({ deleted: true }),
        vectorStoresCreate: vi.fn(),
        vectorStoresFilesCreate: vi.fn(),
        vectorStoresFilesRetrieve: vi.fn(),
        vectorStoresDelete: vi.fn().mockResolvedValue({ deleted: true }),

        // Agents
        run: vi.fn(),
        agentConstructor: vi.fn(),
        fileSearchTool: vi.fn()
    };
});

vi.mock('openai', () => {
    return {
        default: class OpenAI {
            files = {
                create: mocks.filesCreate,
                delete: mocks.filesDel
            };
            vectorStores = {
                create: mocks.vectorStoresCreate,
                delete: mocks.vectorStoresDelete,
                files: {
                    create: mocks.vectorStoresFilesCreate,
                    retrieve: mocks.vectorStoresFilesRetrieve
                }
            };
        }
    };
});

vi.mock('@openai/agents', () => {
    return {
        Agent: class MockAgent {
            constructor(args: unknown) { mocks.agentConstructor(args); }
        },
        run: mocks.run,
        fileSearchTool: mocks.fileSearchTool
    };
});

// Mock Global Fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('OpenAI Workflow Runner Resilience', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');

        // Default success setup for File/VS flow
        mocks.filesCreate.mockResolvedValue({ id: 'file-123' });
        mocks.vectorStoresCreate.mockResolvedValue({ id: 'vs-123' });
        mocks.vectorStoresFilesCreate.mockResolvedValue({ id: 'vs-file-123' });
        // Polling mock: first call returns completed
        mocks.vectorStoresFilesRetrieve.mockResolvedValue({ status: 'completed' });

        // Default agent run success
        mocks.run.mockResolvedValue({
            finalOutput: {
                result: { datosGenerales: { titulo: 'Test Pliego' } }
            }
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe('File Cleanup Guarantee (TC-BE-01)', () => {
        it('should delete uploaded file and vector store if Agent execution fails', async () => {
            // Setup: Agent execution fails
            mocks.run.mockRejectedValue(new Error('Agent Error'));

            const input = {
                pdfBase64: 'JVBERi0xLj...',
                readingMode: 'full' as const,
                hash: 'abc1234',
                filename: 'test.pdf',
                userId: 'user-123'
            };

            await expect(runWorkflow(input)).rejects.toThrow('Agent Error');

            // Assert cleanup happened
            expect(mocks.vectorStoresDelete).toHaveBeenCalledWith('vs-123');
            expect(mocks.filesDel).toHaveBeenCalledWith('file-123');
        });
    });

    describe('Response Parsing (TC-BE-03)', () => {
        it('should return result from Agent', async () => {
            const mockOutput = { result: { datosGenerales: { titulo: 'Success' } } };
            mocks.run.mockResolvedValue({ finalOutput: mockOutput });

            const input = {
                pdfBase64: 'JVBERi0xLj...',
                readingMode: 'full' as const,
                hash: 'abc1234',
                userId: 'user-123'
            };

            const result = await runWorkflow(input);

            expect(result).toEqual(mockOutput);
            expect(mocks.filesCreate).toHaveBeenCalled();
            expect(mocks.vectorStoresCreate).toHaveBeenCalled();
            expect(mocks.vectorStoresFilesCreate).toHaveBeenCalled();
            expect(mocks.run).toHaveBeenCalled();

            // Cleanup check
            expect(mocks.vectorStoresDelete).toHaveBeenCalledWith('vs-123');
            expect(mocks.filesDel).toHaveBeenCalledWith('file-123');
        });

        it('should handle polling failure', async () => {
            // Setup polling to fail
            mocks.vectorStoresFilesRetrieve.mockResolvedValue({ status: 'failed' });

            const input = {
                pdfBase64: 'UVZ...',
                readingMode: 'full' as const,
                hash: 'abc1234',
                userId: 'user-123'
            };

            await expect(runWorkflow(input)).rejects.toThrow('OpenAI failed to process the PDF file');

            // Cleanup should happen
            expect(mocks.vectorStoresDelete).toHaveBeenCalledWith('vs-123');
            expect(mocks.filesDel).toHaveBeenCalledWith('file-123');
        });
    });
});
