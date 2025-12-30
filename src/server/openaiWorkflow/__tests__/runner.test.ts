import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runWorkflow } from '../runner';

// Mock OpenAI
const mockFilesCreate = vi.fn();
const mockFilesDel = vi.fn().mockResolvedValue({});

vi.mock('openai', () => {
    return {
        default: class OpenAI {
            files = {
                create: mockFilesCreate,
                delete: mockFilesDel
            };
        }
    };
});

// Mock Global Fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('OpenAI Workflow Runner Resilience', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Default environment setup
        vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');
        vi.stubEnv('OPENAI_AGENT_ID', 'wf_test_agent');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe('File Cleanup Guarantee (TC-BE-01)', () => {
        it('should delete uploaded file if Agent execution fails', async () => {
            // Setup: File upload succeeds
            mockFilesCreate.mockResolvedValue({ id: 'file-123' });

            // Setup: Agent execution fails (Fetch Error)
            mockFetch.mockRejectedValue(new Error('Network Error'));

            const input = {
                pdfBase64: 'JVBERi0xLj...',
                readingMode: 'full' as const,
                hash: 'abc1234',
                filename: 'test.pdf',
                userId: 'user-123'
            };

            // Execute & Expect Error
            await expect(runWorkflow(input)).rejects.toThrow('Network Error');

            // Verification: File delete called
            expect(mockFilesDel).toHaveBeenCalledWith('file-123');
            expect(mockFilesDel).toHaveBeenCalledTimes(1);
        });

        it('should delete uploaded file if Agent execution returns 500', async () => {
            mockFilesCreate.mockResolvedValue({ id: 'file-456' });
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: () => Promise.resolve('Internal Server Error')
            });

            const input = {
                pdfBase64: 'base64...',
                readingMode: 'full' as const,
                hash: 'hash',
                filename: 'test.pdf',
                userId: 'user-123'
            };

            await expect(runWorkflow(input)).rejects.toThrow('Error ejecución Agente (500)');
            expect(mockFilesDel).toHaveBeenCalledWith('file-456');
        });
    });

    describe('Streaming Chunk Parsing (TC-BE-02)', () => {
        it('should correctly assemble split SSE chunks', async () => {
            mockFilesCreate.mockResolvedValue({ id: 'file-stream' });

            // Simulate partial chunks
            // Chunk 1: 'data: {"delta":'
            // Chunk 2: ' {"content": "Hello"}}'
            // Chunk 3: '\n\n'
            const events = [
                'data: {"delta":',
                ' {"content": "Hello"}}\n\n',
                'data: {"delta": {"content": " World"}}\n\n'
            ];

            const stream = new ReadableStream({
                start(controller) {
                    const encoder = new TextEncoder();
                    events.forEach(e => controller.enqueue(encoder.encode(e)));
                    controller.close();
                }
            });

            mockFetch.mockResolvedValue({
                ok: true,
                body: stream
            });

            const onProgress = vi.fn();
            const input = {
                pdfBase64: 'base64',
                readingMode: 'full' as const,
                hash: 'hash',
                userId: 'user-123'
            };

            // We expect it to eventually parse "Hello" and " World"
            // But runWorkflow returns the FINAL json. 
            // So we need the stream to ALSO contain the JSON result at the end? 
            // Or does runWorkflow accumulate text and parse it?
            // checking runner.ts: it accumulates into `fullContent` and parses JSON from there.

            // Let's add the JSON result to the stream
            // The runner looks for JSON in `fullContent`.
            // So we need the stream to ALSO contain the JSON result at the end? 
            // Or does runWorkflow accumulate text and parse it?
            // checking runner.ts: it accumulates into `fullContent` and parses JSON from there.

            // Let's add the JSON result to the stream
            // The runner looks for JSON in `fullContent`.
            // So we need to stream the JSON text too.
            // Let's append a valid JSON block.

            /* 
               The runner loop: 
               buffer += chunk
               lines = buffer.split('\n')
               ... 
               if line starts with 'data: ' -> parse
               
               Wait, the runner expects specifically formatted SSE events?
               Runner logic:
                 if (line.startsWith('data: ')) {
                     const dataStr = line.replace('data: ', '').trim();
                     const event = JSON.parse(dataStr);
                     if (event.delta?.content) onProgress...
                 }
               
               It accumulates `event.delta.content` into `fullContent`.
            */



            // Re-design events to match Runner expectation (it parses lines starting with data:)
            // Runner does NOT handle partial lines well based on `buffer = lines.pop()`.
            // Wait, `lines.pop()` KEEPS the last incomplete line in buffer.
            // So if Chunk 1 is `data: {"del` (no newline), it stays in buffer.
            // Chunk 2 adds `ta": ...}}\n`. Now we have a full line.

            const splitEvents = [
                // Event 1 split across chunks
                'data: {"delta": {"co',
                'ntent": "Hello "}}\n\n',

                // Event 2 (JSON part 1)
                'data: {"delta": {"content": "{\\"datosGenerales\\": "}}\n\n',

                // Event 3 (JSON part 2)
                'data: {"delta": {"content": "{\\"titulo\\": \\"Test\\"}}"}}\n\n'
            ];

            const stream2 = new ReadableStream({
                start(controller) {
                    const encoder = new TextEncoder();
                    splitEvents.forEach(e => controller.enqueue(encoder.encode(e)));
                    controller.close();
                }
            });

            mockFetch.mockResolvedValue({
                ok: true,
                body: stream2
            });

            const result = await runWorkflow(input, { onProgress });

            // Verify delta callbacks
            expect(onProgress).toHaveBeenCalledWith('delta', 'Hello ');
            expect(onProgress).toHaveBeenCalledWith('delta', '{"datosGenerales": ');
            expect(onProgress).toHaveBeenCalledWith('delta', '{"titulo": "Test"}}');

            // Verify final return
            expect(result).toEqual({ datosGenerales: { titulo: "Test" } });
        });
    });

    describe('Malformed Agent Output (TC-BE-03)', () => {
        it('should throw error if Agent output is not valid JSON', async () => {
            mockFilesCreate.mockResolvedValue({ id: 'file-bad-json' });

            const stream = new ReadableStream({
                start(controller) {
                    const encoder = new TextEncoder();
                    // Stream just plain text, no JSON
                    controller.enqueue(encoder.encode('data: {"delta": {"content": "I am not JSON"}}\n\n'));
                    controller.close();
                }
            });

            mockFetch.mockResolvedValue({
                ok: true,
                body: stream
            });

            const input = {
                pdfBase64: 'base64',
                readingMode: 'full' as const,
                hash: 'hash',
                userId: 'user-123'
            };

            await expect(runWorkflow(input)).rejects.toThrow('El Agente no devolvió una respuesta JSON válida');
        });

        it('should extract JSON even if wrapped in markdown', async () => {
            mockFilesCreate.mockResolvedValue({ id: 'file-markdown' });

            const jsonString = JSON.stringify({ datosGenerales: { titulo: "Markdown" } });
            const content = `Here is the result:\n\`\`\`json\n${jsonString}\n\`\`\``;

            // Escape for double JSON stringify (streaming a string containing json)
            const eventPayload = JSON.stringify({ delta: { content } });

            const stream = new ReadableStream({
                start(controller) {
                    const encoder = new TextEncoder();
                    controller.enqueue(encoder.encode(`data: ${eventPayload}\n\n`));
                    controller.close();
                }
            });

            mockFetch.mockResolvedValue({
                ok: true,
                body: stream
            });

            const result = await runWorkflow({
                pdfBase64: 'base64',
                readingMode: 'full' as const,
                hash: 'hash',
                userId: 'user-123'
            });

            expect(result).toEqual({ datosGenerales: { titulo: "Markdown" } });
        });
    });
});
