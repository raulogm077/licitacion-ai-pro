import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToJson, exportToExcel } from '../export-utils';
import * as XLSX from 'xlsx';

// Mock XLSX
vi.mock('xlsx', () => ({
    utils: {
        book_new: vi.fn(),
        aoa_to_sheet: vi.fn(),
        book_append_sheet: vi.fn()
    },
    writeFile: vi.fn()
}));

describe('Export Utils', () => {
    const mockData: any = {
        datosGenerales: {
            titulo: 'Test Title',
            presupuesto: 1000,
            moneda: 'EUR',
            plazoEjecucionMeses: 12,
            cpv: ['123', '456'],
            organoContratacion: 'Org Test'
        },
        criteriosAdjudicacion: {
            subjetivos: [{ descripcion: 'Subj 1', ponderacion: 10, detalles: 'Det 1' }],
            objetivos: [{ descripcion: 'Obj 1', ponderacion: 20, formula: 'Form 1' }]
        },
        requisitosTecnicos: {
            funcionales: [{ requisito: 'Req 1', obligatorio: true, referenciaPagina: '1' }],
            normativa: []
        },
        requisitosSolvencia: {
            economica: {},
            tecnica: []
        },
        restriccionesYRiesgos: {
            riesgos: [{ descripcion: 'Risk 1', impacto: 'ALTO', probabilidad: 'MEDIA', mitigacionSugerida: 'Mit 1' }],
            killCriteria: [],
            penalizaciones: []
        },
        modeloServicio: { sla: [], equipoMinimo: [] }
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

        vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
        vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
        vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should export JSON correctly', () => {
        exportToJson(mockData, 'test-file');

        expect(document.createElement).toHaveBeenCalledWith('a');
        expect(document.body.appendChild).toHaveBeenCalled();
        expect(global.URL.createObjectURL).toHaveBeenCalled();
        // Check content implies Blob usage, harder to spy on Blob constructor directly without polyfill or deeper mock.
        // Assuming Blob creation doesn't crash is good enough for unit test of the utility flow.
    });

    it('should export Excel using XLSX library', () => {
        exportToExcel(mockData, 'test-file');

        expect(XLSX.utils.book_new).toHaveBeenCalled();
        // Sheets: 1 General, 1 Criterios, 1 Requisitos, 1 Riesgos = 4 sheets
        expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalledTimes(4);
        expect(XLSX.utils.book_append_sheet).toHaveBeenCalledTimes(4);
        expect(XLSX.writeFile).toHaveBeenCalledWith(undefined, 'test-file.xlsx');
    });
});
