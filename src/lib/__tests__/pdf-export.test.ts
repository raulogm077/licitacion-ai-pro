import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToPDF } from '../pdf-export';
import { LicitacionData } from '../../types';

// The vitest mock hoisting mechanism requires defining mocks INSIDE the factory or using
// variables that start with `mock` IF using vi.mock('module', factory).
// The easiest way to deal with constructor mocks without hoisted variables issue
// is to return an anonymous class/function directly.

vi.mock('jspdf', () => {
    return {
        default: vi.fn().mockImplementation(function() {
            return {
                internal: {
                    pageSize: {
                        getWidth: vi.fn(() => 210)
                    }
                },
                setFontSize: vi.fn(),
                setFont: vi.fn(),
                text: vi.fn(),
                addPage: vi.fn(),
                save: vi.fn(),
                lastAutoTable: { finalY: 50 }
            };
        })
    };
});

vi.mock('jspdf-autotable', () => {
    return {
        default: vi.fn()
    };
});

describe('PDF Export Utils', () => {
    let jsPDFMock: any;
    let autoTableMock: any;

    const baseMockData: LicitacionData = {
        datosGenerales: {
            titulo: 'Test Title PDF',
            presupuesto: 1500,
            moneda: 'EUR',
            plazoEjecucionMeses: 6,
            cpv: ['123', '456'],
            organoContratacion: 'Org Test PDF',
            fechaLimitePresentacion: '2025-10-10'
        },
        criteriosAdjudicacion: {
            subjetivos: [{ descripcion: 'Subj 1', ponderacion: 30, detalles: 'Det 1' }],
            objetivos: [{ descripcion: 'Obj 1', ponderacion: 70, formula: 'Form 1' }]
        },
        requisitosTecnicos: {
            funcionales: [],
            normativa: []
        },
        requisitosSolvencia: {
            economica: { cifraNegocioAnualMinima: 10000 },
            tecnica: [{ descripcion: 'Tech 1', proyectosSimilaresRequeridos: 3, importeMinimoProyecto: 5000 }]
        },
        restriccionesYRiesgos: {
            riesgos: [],
            killCriteria: [],
            penalizaciones: []
        },
        modeloServicio: { sla: [], equipoMinimo: [] },
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        // Import dynamically to access the generated mocks
        const jsPDFModule = await import('jspdf');
        const autoTableModule = await import('jspdf-autotable');
        jsPDFMock = jsPDFModule.default;
        autoTableMock = autoTableModule.default;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should export minimal PDF correctly without optional sections', () => {
        exportToPDF(baseMockData, 'minimal-test-file');

        expect(jsPDFMock).toHaveBeenCalled();

        // Get the mocked instance
        const mockInstance = jsPDFMock.mock.results[0].value;

        expect(mockInstance.internal.pageSize.getWidth).toHaveBeenCalled();
        expect(mockInstance.setFontSize).toHaveBeenCalled();
        expect(mockInstance.setFont).toHaveBeenCalled();
        expect(mockInstance.text).toHaveBeenCalled();

        // General Info, Criteria, Solvency
        expect(autoTableMock).toHaveBeenCalledTimes(3);

        // Verify filename
        expect(mockInstance.save).toHaveBeenCalledWith('minimal-test-file.pdf');

        // Verify missing sections (Requirements, Risks, Metadata) didn't add pages
        // Initial setup + Criteria page + Solvency page = 2 addPage calls. General Info is on page 1.
        expect(mockInstance.addPage).toHaveBeenCalledTimes(2);
    });

    it('should export full PDF correctly with all sections', () => {
        const fullMockData: LicitacionData = {
            ...baseMockData,
            metadata: {
                cliente: 'Cliente Test',
                importeAdjudicado: 1200,
                estado: 'ADJUDICADA',
                tags: ['tagA', 'tagB']
            },
            requisitosTecnicos: {
                funcionales: [
                    { requisito: 'Req Funcional 1', obligatorio: true, referenciaPagina: 15 },
                    { requisito: 'Req Funcional 2', obligatorio: false }
                ],
                normativa: []
            },
            restriccionesYRiesgos: {
                riesgos: [
                    { descripcion: 'Riesgo 1', impacto: 'ALTO', probabilidad: 'ALTA', mitigacionSugerida: 'Mitigar 1' }
                ],
                killCriteria: [],
                penalizaciones: []
            }
        };

        exportToPDF(fullMockData, 'full-test-file');

        expect(jsPDFMock).toHaveBeenCalled();
        const mockInstance = jsPDFMock.mock.results[0].value;

        // General Info, Metadata, Criteria, Requirements, Risks, Solvency
        expect(autoTableMock).toHaveBeenCalledTimes(6);
        expect(mockInstance.save).toHaveBeenCalledWith('full-test-file.pdf');

        // Metadata (+1), Criteria (+1), Requirements (+1), Risks (+1), Solvency (+1)
        expect(mockInstance.addPage).toHaveBeenCalledTimes(5);

        // Verify data structure sent to autoTable for Metadata
        const metadataCallArgs = autoTableMock.mock.calls[1][1];
        expect(metadataCallArgs.head[0]).toEqual(['Campo', 'Valor']);

        // Use regex for currency due to node/ICU variations
        const bodyArray = metadataCallArgs.body;
        expect(bodyArray[0]).toEqual(['Cliente', 'Cliente Test']);
        expect(bodyArray[1][0]).toBe('Importe Adjudicado');
        expect(bodyArray[1][1]).toMatch(/1\.?200,00\s*\u00A0?\u20ac/); // 1.200,00 € or variations
        expect(bodyArray[2]).toEqual(['Estado', 'ADJUDICADA']);
        expect(bodyArray[3]).toEqual(['Tags', 'tagA, tagB']);
    });

    it('should handle edge cases like null/missing values gracefully', () => {
        const edgeCaseData: LicitacionData = {
            ...baseMockData,
            datosGenerales: {
                ...baseMockData.datosGenerales,
                fechaLimitePresentacion: undefined, // Missing optional date
            },
            criteriosAdjudicacion: {
                subjetivos: [{ descripcion: 'Subj 1', ponderacion: 30 }], // Missing optional detalles
                objetivos: [{ descripcion: 'Obj 1', ponderacion: 70 }] // Missing optional formula
            },
            requisitosSolvencia: {
                economica: { cifraNegocioAnualMinima: 0 },
                tecnica: [{ descripcion: 'Tech 1', proyectosSimilaresRequeridos: 1 }] // Missing optional importeMinimoProyecto
            }
        };

        exportToPDF(edgeCaseData, 'edge-case-file');

        expect(jsPDFMock).toHaveBeenCalled();
        const mockInstance = jsPDFMock.mock.results[0].value;

        expect(mockInstance.save).toHaveBeenCalledWith('edge-case-file.pdf');

        // Verify general info table handles missing date
        const generalInfoCallArgs = autoTableMock.mock.calls[0][1];
        const dateRow = generalInfoCallArgs.body.find((row: any) => row[0] === 'Fecha Límite');
        expect(dateRow[1]).toBe('N/A');

        // Verify criteria table handles missing details/formulas
        const criteriaCallArgs = autoTableMock.mock.calls[1][1];
        expect(criteriaCallArgs.body[0][3]).toBe(''); // detalles fallback
        expect(criteriaCallArgs.body[1][3]).toBe(''); // formula fallback

        // Verify technical solvency handles missing importe
        const solvencyCallArgs = autoTableMock.mock.calls[2][1];
        const techSolvencyRow = solvencyCallArgs.body.find((row: any) => row[0].startsWith('Técnica -'));
        expect(techSolvencyRow[1]).toBe('1 proyectos');
    });
});
