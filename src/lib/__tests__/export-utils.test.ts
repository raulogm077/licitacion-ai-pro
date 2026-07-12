import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportAnalyticsToExcel, exportLicitacionToExcel } from '../export-utils';
import { LicitacionContent } from '../../types';
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
            evolucionMensual: [],
            promedioCriterios: { subjetivos: 40, objetivos: 60 },
        };

        await exportAnalyticsToExcel(analyticsData, 'test-analytics');

        expect(mockAddWorksheet).toHaveBeenCalledTimes(3);
        expect(mockWriteBuffer).toHaveBeenCalled();
        expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should export a licitacion report with all six sheets', async () => {
        const content = {
            datosGenerales: {
                titulo: tf('Licitación Test'),
                organoContratacion: tf('Ayuntamiento'),
                presupuesto: tf(120000),
                moneda: tf('EUR'),
                plazoEjecucionMeses: tf(18),
                cpv: tf(['72000000']),
                fechaLimitePresentacion: '2026-09-01',
            },
            criteriosAdjudicacion: {
                subjetivos: [{ descripcion: 'Calidad', ponderacion: 40, subcriterios: [] }],
                objetivos: [{ descripcion: 'Precio', ponderacion: 60 }],
            },
            requisitosSolvencia: {
                economica: { cifraNegocioAnualMinima: 200000 },
                tecnica: [{ descripcion: 'Experiencia', proyectosSimilaresRequeridos: 2 }],
                profesional: [{ descripcion: 'Titulación' }],
            },
            requisitosTecnicos: {
                funcionales: [{ requisito: 'Alta disponibilidad', obligatorio: true }],
                normativa: [{ norma: 'ENS' }],
            },
            restriccionesYRiesgos: {
                killCriteria: [{ criterio: 'Certificación obligatoria' }],
                penalizaciones: [{ causa: 'Retraso', sancion: '1%/día' }],
                riesgos: [{ descripcion: 'Plazo ajustado', impacto: 'ALTO' }],
            },
            modeloServicio: {
                sla: [{ metrica: 'Disponibilidad', objetivo: '99.9%' }],
                equipoMinimo: [{ rol: 'Jefe de proyecto', experienciaAnios: 5 }],
            },
        } as unknown as LicitacionContent;

        await exportLicitacionToExcel(content, 'informe-test');

        expect(mockAddWorksheet).toHaveBeenCalledTimes(6);
        expect(mockAddWorksheet).toHaveBeenCalledWith('Datos Generales');
        expect(mockAddWorksheet).toHaveBeenCalledWith('Riesgos');
        expect(mockWriteBuffer).toHaveBeenCalled();
        expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
});
