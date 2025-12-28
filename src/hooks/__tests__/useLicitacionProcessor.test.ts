import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLicitacionProcessor } from '../useLicitacionProcessor';
import { AIService } from '../../services/ai.service';
import { dbService } from '../../services/db.service';
import * as fileUtils from '../../lib/file-utils';

// Mocks
vi.mock('../../services/ai.service');
vi.mock('../../services/db.service');
vi.mock('../../lib/file-utils');

describe('useLicitacionProcessor', () => {
    const mockFile = new File(['%PDF-1.7 dummy content'], 'test.pdf', { type: 'application/pdf' });

    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default mock behaviors
        vi.mocked(fileUtils.validatePdfMagicBytes).mockResolvedValue(true);
        vi.mocked(fileUtils.generateFileHash).mockResolvedValue('hash123');
        vi.mocked(fileUtils.readFileAsBase64).mockResolvedValue('base64content');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(AIService.prototype.analyzePdfContent).mockResolvedValue({ some: 'data' } as any);
        vi.mocked(dbService.saveLicitacion).mockResolvedValue(undefined);
        vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
    });

    it('should initialize with IDLE state', () => {
        const { result } = renderHook(() => useLicitacionProcessor());
        expect(result.current.state.status).toBe('IDLE');
    });

    it('should process file successfully', async () => {
        const { result } = renderHook(() => useLicitacionProcessor());

        await act(async () => {
            await result.current.processFile(mockFile);
        });

        expect(result.current.state.status).toBe('COMPLETED');
        expect(result.current.state.progress).toBe(100);
        expect(result.current.state.data).toEqual({ some: 'data' });
        expect(result.current.state.hash).toBeTruthy(); // Real hash is generated
        expect(dbService.saveLicitacion).toHaveBeenCalledWith(expect.any(String), 'test.pdf', { some: 'data' });
    });

    it('should handle invalid PDF', async () => {
        const invalidFile = new File(['invalid content'], 'invalid.pdf', { type: 'application/pdf' });
        const { result } = renderHook(() => useLicitacionProcessor());

        await act(async () => {
            await result.current.processFile(invalidFile);
        });

        expect(result.current.state.status).toBe('ERROR');
        expect(result.current.state.error).toContain('Magic Bytes mismatch');
    });

    it('should handle AI error', async () => {
        vi.mocked(AIService.prototype.analyzePdfContent).mockRejectedValue(new Error('AI Failed'));
        const { result } = renderHook(() => useLicitacionProcessor());

        await act(async () => {
            await result.current.processFile(mockFile);
        });

        expect(result.current.state.status).toBe('ERROR');
        expect(result.current.state.error).toContain('AI Failed');
    });

    it('should reject empty file (0 bytes)', async () => {
        const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
        const { result } = renderHook(() => useLicitacionProcessor());

        await act(async () => {
            await result.current.processFile(emptyFile);
        });

        expect(result.current.state.status).toBe('ERROR');
        expect(result.current.state.error).toContain('Magic Bytes mismatch');
    });

    it('should reject small file (< 5 bytes)', async () => {
        const smallFile = new File(['%PDF'], 'small.pdf', { type: 'application/pdf' }); // 4 bytes
        const { result } = renderHook(() => useLicitacionProcessor());

        await act(async () => {
            await result.current.processFile(smallFile);
        });

        expect(result.current.state.status).toBe('ERROR');
        expect(result.current.state.error).toContain('Magic Bytes mismatch');
    });

    it('should continue if save fails (warning only)', async () => {
        vi.mocked(dbService.saveLicitacion).mockRejectedValue(new Error('Save Failed'));
        const { result } = renderHook(() => useLicitacionProcessor());

        await act(async () => {
            await result.current.processFile(mockFile);
        });

        // Should still be COMPLETED
        expect(result.current.state.status).toBe('COMPLETED');
        // Logic appends warning to thinkingOutput
        expect(result.current.state.thinkingOutput).toContain('Advertencia');
    });

    it('should fail if API Key is missing', async () => {
        vi.stubEnv('VITE_GEMINI_API_KEY', '');
        const { result } = renderHook(() => useLicitacionProcessor());

        await act(async () => {
            await result.current.processFile(mockFile);
        });

        expect(result.current.state.status).toBe('ERROR');
        expect(result.current.state.error).toContain('API Key no configurada');
    });
});
