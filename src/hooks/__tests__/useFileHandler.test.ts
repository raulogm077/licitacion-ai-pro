import { renderHook, act } from '@testing-library/react';
import { useFileHandler } from '../useFileHandler';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as fileUtils from '../../lib/file-utils';

vi.mock('../../lib/file-utils', async () => {
    const actual = await vi.importActual('../../lib/file-utils');
    return {
        ...actual,
        generateBufferHash: vi.fn(),
        validateBufferMagicBytes: vi.fn(),
        bufferToBase64: vi.fn(),
    };
});

describe('useFileHandler', () => {
    const mockFile = new File(['%PDF-mock-content'], 'test.pdf', { type: 'application/pdf' });
    mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize with IDLE state', () => {
        const { result } = renderHook(() => useFileHandler());
        expect(result.current.fileState).toEqual({
            status: 'IDLE',
            file: null,
            base64: null,
            hash: null,
            error: null,
        });
    });

    it('should process a valid PDF file successfully', async () => {
        vi.mocked(fileUtils.validateBufferMagicBytes).mockReturnValue(true);
        vi.mocked(fileUtils.generateBufferHash).mockResolvedValue('mock-hash');
        vi.mocked(fileUtils.bufferToBase64).mockResolvedValue('mock-base64');

        const { result } = renderHook(() => useFileHandler());

        let processResult;
        await act(async () => {
            processResult = await result.current.processFile(mockFile);
        });

        expect(processResult).toEqual({ hash: 'mock-hash', base64: 'mock-base64' });
        expect(result.current.fileState).toEqual({
            status: 'READY',
            file: mockFile,
            base64: 'mock-base64',
            hash: 'mock-hash',
            error: null,
        });
    });

    it('should handle Magic Bytes mismatch error', async () => {
        vi.mocked(fileUtils.validateBufferMagicBytes).mockReturnValue(false);

        const { result } = renderHook(() => useFileHandler());

        await act(async () => {
            await expect(result.current.processFile(mockFile)).rejects.toThrow("El archivo no es un PDF válido (Magic Bytes mismatch).");
        });

        expect(result.current.fileState).toEqual({
            status: 'ERROR',
            file: mockFile,
            base64: null,
            hash: null,
            error: "El archivo no es un PDF válido (Magic Bytes mismatch).",
        });
    });

    it('should handle generic errors during file processing', async () => {
        const errorMockFile = new File([''], 'error.pdf', { type: 'application/pdf' });
        errorMockFile.arrayBuffer = vi.fn().mockRejectedValue(new Error('ArrayBuffer error'));

        const { result } = renderHook(() => useFileHandler());

        await act(async () => {
            await expect(result.current.processFile(errorMockFile)).rejects.toThrow('ArrayBuffer error');
        });

        expect(result.current.fileState).toEqual({
            status: 'ERROR',
            file: errorMockFile,
            base64: null,
            hash: null,
            error: 'ArrayBuffer error',
        });
    });

    it('should handle unknown errors gracefully', async () => {
        const errorMockFile = new File([''], 'unknown-error.pdf', { type: 'application/pdf' });
        errorMockFile.arrayBuffer = vi.fn().mockRejectedValue('String error');

        const { result } = renderHook(() => useFileHandler());

        await act(async () => {
            await expect(result.current.processFile(errorMockFile)).rejects.toEqual('String error');
        });

        expect(result.current.fileState).toEqual({
            status: 'ERROR',
            file: errorMockFile,
            base64: null,
            hash: null,
            error: 'Error leyendo el archivo',
        });
    });

    it('should reset state correctly', async () => {
        vi.mocked(fileUtils.validateBufferMagicBytes).mockReturnValue(true);
        vi.mocked(fileUtils.generateBufferHash).mockResolvedValue('mock-hash');
        vi.mocked(fileUtils.bufferToBase64).mockResolvedValue('mock-base64');

        const { result } = renderHook(() => useFileHandler());

        await act(async () => {
            await result.current.processFile(mockFile);
        });

        expect(result.current.fileState.status).toBe('READY');

        act(() => {
            result.current.resetFile();
        });

        expect(result.current.fileState).toEqual({
            status: 'IDLE',
            file: null,
            base64: null,
            hash: null,
            error: null,
        });
    });
});
