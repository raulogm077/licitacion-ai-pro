import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useFileValidation } from '../useFileValidation';

const createMockFile = (name: string, size: number, type = 'application/pdf'): File => {
    const buffer = new ArrayBuffer(size);
    return new File([buffer], name, { type });
};

const createFileList = (files: File[]): FileList => {
    // jsdom doesn't have DataTransfer, use a mock FileList
    const fileList = Object.assign(files, {
        item: (i: number) => files[i] ?? null,
    });
    return fileList as unknown as FileList;
};

describe('useFileValidation', () => {
    it('starts with empty state', () => {
        const { result } = renderHook(() => useFileValidation());
        expect(result.current.selectedFiles).toEqual([]);
        expect(result.current.validationError).toBeNull();
    });

    it('adds PDF files', () => {
        const { result } = renderHook(() => useFileValidation());
        const file = createMockFile('test.pdf', 1024);

        act(() => {
            result.current.addFiles(createFileList([file]));
        });

        expect(result.current.selectedFiles).toHaveLength(1);
        expect(result.current.selectedFiles[0].name).toBe('test.pdf');
    });

    it('filters non-PDF files', () => {
        const { result } = renderHook(() => useFileValidation());
        const pdf = createMockFile('doc.pdf', 1024);
        const txt = createMockFile('doc.txt', 1024, 'text/plain');

        act(() => {
            result.current.addFiles(createFileList([pdf, txt]));
        });

        expect(result.current.selectedFiles).toHaveLength(1);
        expect(result.current.selectedFiles[0].name).toBe('doc.pdf');
    });

    it('limits to 5 files max', () => {
        const { result } = renderHook(() => useFileValidation());
        const files = Array.from({ length: 7 }, (_, i) => createMockFile(`file${i}.pdf`, 1024));

        act(() => {
            result.current.addFiles(createFileList(files));
        });

        expect(result.current.selectedFiles).toHaveLength(5);
        expect(result.current.validationError).toContain('5');
    });

    it('rejects when total size exceeds 30MB', () => {
        const { result } = renderHook(() => useFileValidation());
        const largeFile = createMockFile('large.pdf', 31 * 1024 * 1024);

        act(() => {
            result.current.addFiles(createFileList([largeFile]));
        });

        expect(result.current.selectedFiles).toHaveLength(0);
        expect(result.current.validationError).toContain('30');
    });

    it('removes file by index', () => {
        const { result } = renderHook(() => useFileValidation());
        const files = [createMockFile('a.pdf', 1024), createMockFile('b.pdf', 1024)];

        act(() => {
            result.current.addFiles(createFileList(files));
        });
        act(() => {
            result.current.removeFile(0);
        });

        expect(result.current.selectedFiles).toHaveLength(1);
        expect(result.current.selectedFiles[0].name).toBe('b.pdf');
    });

    it('clears all files', () => {
        const { result } = renderHook(() => useFileValidation());

        act(() => {
            result.current.addFiles(createFileList([createMockFile('a.pdf', 1024)]));
        });
        act(() => {
            result.current.clearAll();
        });

        expect(result.current.selectedFiles).toHaveLength(0);
        expect(result.current.validationError).toBeNull();
    });

    it('handles null input gracefully', () => {
        const { result } = renderHook(() => useFileValidation());

        act(() => {
            result.current.addFiles(null);
        });

        expect(result.current.selectedFiles).toHaveLength(0);
    });
});
