import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportAnalyticsToExcel } from '../export-utils';

// Mock ExcelJS
const mockAddRows = vi.fn();
const mockAddRow = vi.fn();
const mockAddWorksheet = vi.fn(() => ({
    columns: [],
    addRows: mockAddRows,
    addRow: mockAddRow,
}));
const mockWriteBuffer = vi.fn(() => Promise.resolve(new ArrayBuffer(8)));

vi.mock('exceljs', () => {
    return {
        default: {
            Workbook: vi.fn(function () {
                return {
                    addWorksheet: mockAddWorksheet,
                    xlsx: {
                        writeBuffer: mockWriteBuffer,
                    },
                };
            }),
        },
    };
});

describe('Export Utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        global.URL.createObjectURL = vi.fn(() => 'mock-url');
        global.URL.revokeObjectURL = vi.fn();

        const mockLink = {
            click: vi.fn(),
            href: '',
            download: '',
        };

        vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLAnchorElement);
        vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as HTMLAnchorElement);
        vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as HTMLAnchorElement);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should export analytics to Excel', async () => {
        const analyticsData = {
            totalLicitaciones: 10,
            presupuestoTotal: 500000,
            presupuestoPromedio: 50000,
            importeAdjudicadoTotal: 400000,
            tiempoAnalisisPromedio: 1200,
            distribucionEstados: { completado: 8, pendiente: 2 },
            distribucionRiesgos: { ALTO: 2, MEDIO: 3 },
            topClientes: [{ cliente: 'Ministerio', count: 5, total: 300000 }],
            topTags: [{ tag: 'TI', count: 4 }],
            tendenciaMensual: [],
            promedioCriterios: { subjetivos: 40, objetivos: 60 },
        };

        await exportAnalyticsToExcel(analyticsData, 'test-analytics');

        expect(mockAddWorksheet).toHaveBeenCalledTimes(3);
        expect(mockWriteBuffer).toHaveBeenCalled();
        expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
});
