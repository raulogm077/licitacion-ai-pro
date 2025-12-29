import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToJson, exportToExcel } from '../export-utils';

// Mock ExcelJS
const mockAddRows = vi.fn();
const mockAddRow = vi.fn();
const mockAddWorksheet = vi.fn(() => ({
    columns: [],
    addRows: mockAddRows,
    addRow: mockAddRow
}));
const mockWriteBuffer = vi.fn(() => Promise.resolve(new ArrayBuffer(8)));

// Correctly mock the default export for ExcelJS
vi.mock('exceljs', () => {
    return {
        default: {
            Workbook: vi.fn(function () {
                return {
                    creator: '',
                    lastModifiedBy: '',
                    created: new Date(),
                    modified: new Date(),
                    addWorksheet: mockAddWorksheet,
                    xlsx: {
                        writeBuffer: mockWriteBuffer
                    }
                };
            })
        }
    };
});

describe('Export Utils', () => {
    const mockData = {
        datosGenerales: {
            titulo: 'Test Title',
            presupuesto: 1000,
            moneda: 'EUR',
            plazoEjecucionMeses: 12,
            cpv: ['123', '456'],
            organoContratacion: 'Org Test',
            fechaLimitePresentacion: '2025-12-31'
        },
        criteriosAdjudicacion: {
            subjetivos: [{ descripcion: 'Subj 1', ponderacion: 10, detalles: 'Det 1' }],
            objetivos: [{ descripcion: 'Obj 1', ponderacion: 20, formula: 'Form 1' }]
        },
        requisitosTecnicos: {
            funcionales: [{ requisito: 'Req 1', obligatorio: true, referenciaPagina: 1 }],
            normativa: []
        },
        requisitosSolvencia: {
            economica: { cifraNegocioAnualMinima: 0 },
            tecnica: []
        },
        restriccionesYRiesgos: {
            riesgos: [{ descripcion: 'Risk 1', impacto: 'ALTO' as const, probabilidad: 'MEDIA' as const, mitigacionSugerida: 'Mit 1' }],
            killCriteria: [],
            penalizaciones: []
        },
        modeloServicio: { sla: [], equipoMinimo: [] },
        metadata: { tags: [] }
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock DOM/Window globals for download simulation
        global.URL.createObjectURL = vi.fn(() => 'mock-url');
        global.URL.revokeObjectURL = vi.fn();

        // Mock document.createElement and body methods
        const mockLink = {
            click: vi.fn(),
            href: '',
            download: ''
        };

        vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLAnchorElement);
        vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as HTMLAnchorElement);
        vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as HTMLAnchorElement);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should export JSON correctly', () => {
        exportToJson(mockData, 'test-file');

        expect(document.createElement).toHaveBeenCalledWith('a');
        expect(document.body.appendChild).toHaveBeenCalled();
        expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should export Excel using ExcelJS library', async () => {
        await exportToExcel(mockData, 'test-file');

        expect(mockAddWorksheet).toHaveBeenCalledTimes(4); // General, Criterios, Requisitos, Riesgos
        expect(mockWriteBuffer).toHaveBeenCalled();
        expect(global.URL.createObjectURL).toHaveBeenCalled(); // Should trigger download
    });
});
