
import { describe, it, expect, vi } from 'vitest';
import { exportToJson } from '../export-utils';

describe('export-utils', () => {
    describe('exportToJson', () => {
        it('should create a valid JSON blob and trigger download', () => {
            // Mock URL.createObjectURL and document.createElement
            global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
            global.URL.revokeObjectURL = vi.fn();

            const linkMock = {
                href: '',
                download: '',
                click: vi.fn(),
                remove: vi.fn(),
            } as unknown as HTMLAnchorElement;

            const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(linkMock);
            vi.spyOn(document.body, 'appendChild').mockImplementation(() => linkMock);
            vi.spyOn(document.body, 'removeChild').mockImplementation(() => linkMock);

            const data: any = { test: 'data', number: 123 }; // Use any or a partial type that matches LicitacionData structure requirement strictly if needed, but for unit test generic mock is safer with 'as any' if function accepts generics
            exportToJson(data as any, 'test-export');

            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(createElementSpy).toHaveBeenCalledWith('a');
            expect(linkMock.download).toBe('test-export.json');
            expect(linkMock.href).toBe('blob:mock-url');
            expect(linkMock.click).toHaveBeenCalled();

            // Cleanup
            vi.restoreAllMocks();
        });
    });
});
