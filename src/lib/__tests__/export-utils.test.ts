import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToJson, exportToExcel } from '../export-utils';
import { tf } from '../../test-utils/tracked-field-factory';

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
                    creator: '',
                    lastModifiedBy: '',
                    created: new Date(),
                    modified: new Date(),
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
    const mockData = {
        datosGenerales: {
            titulo: tf('Test Title'),
            presupuesto: tf(1000),
            moneda: tf('EUR'),
            plazoEjecucionMeses: tf(12),
            cpv: tf(['123', '456']),
            organoContratacion: tf('Org Test'),
            fechaLimitePresentacion: '2025-12-31',
        },
        criteriosAdjudicacion: {
            subjetivos: [{ descripcion: 'Subj 1', ponderacion: 10, detalles: 'Det 1', subcriterios: [] }],
            objetivos: [{ descripcion: 'Obj 1', ponderacion: 20, formula: 'Form 1' }],
        },
        requisitosTecnicos: {
            funcionales: [{ requisito: 'Req 1', obligatorio: true, referenciaPagina: 1 }],
            normativa: [],
        },
        requisitosSolvencia: {
            economica: { cifraNegocioAnualMinima: 0 },
            tecnica: [],
            profesional: [],
        },
        restriccionesYRiesgos: {
            riesgos: [
                {
                    descripcion: 'Risk 1',
                    impacto: 'ALTO' as const,
                    probabilidad: 'MEDIA' as const,
                    mitigacionSugerida: 'Mit 1',
                },
            ],
            killCriteria: [],
            penalizaciones: [],
        },
        modeloServicio: { sla: [], equipoMinimo: [] },
        metadata: { tags: [] },
    };

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

    it('should export JSON correctly', () => {
        exportToJson(mockData, 'test-file');

        expect(document.createElement).toHaveBeenCalledWith('a');
        expect(document.body.appendChild).toHaveBeenCalled();
        expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should export Excel using ExcelJS library', async () => {
        await exportToExcel(mockData, 'test-file');

        expect(mockAddWorksheet).toHaveBeenCalledTimes(4);
        expect(mockWriteBuffer).toHaveBeenCalled();
        expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
});
