import { describe, it, expect } from 'vitest';
import { analistaAgent } from '../analista.agent';
import { LicitacionAgentResponseSchema } from '../schemas/licitacion-agent.schema';

describe('Analista Agent', () => {
    it('should be configured correctly', () => {
        expect(analistaAgent.name).toBe('Analista de Pliegos');
        expect(analistaAgent.model).toBe('gpt-4o-2024-08-06');
    });

    it('should have submit_result tool', () => {
        const tools = analistaAgent.tools;
        const hasTool = tools.some((t: any) => t.name === 'submit_analysis_result');
        expect(hasTool).toBe(true);
    });

    it('schema should validate correct response', () => {
        const mockResponse = {
            result: {
                datosGenerales: {
                    titulo: "Test",
                    presupuesto: 100000,
                    moneda: "EUR",
                    plazoEjecucionMeses: 12,
                    cpv: ["12345678"],
                    organoContratacion: "Test Org"
                },
                criteriosAdjudicacion: {
                    subjetivos: ["Criterio 1"],
                    objetivos: ["Criterio 2"]
                },
                requisitosTecnicos: {
                    funcionales: ["Req 1"],
                    normativa: ["Norma 1"]
                },
                requisitosSolvencia: {
                    economica: {
                        cifraNegocioAnualMinima: 50000,
                        descripcion: "Test"
                    },
                    tecnica: ["Exp 1"]
                },
                restriccionesYRiesgos: {
                    killCriteria: ["Kill 1"],
                    riesgos: ["Riesgo 1"],
                    penalizaciones: ["Pen 1"]
                },
                modeloServicio: {
                    sla: ["SLA 1"],
                    equipoMinimo: ["Perfil 1"]
                }
            },
            workflow: {
                quality: {
                    overall: "COMPLETO" as const,
                    bySection: {
                        datosGenerales: "COMPLETO" as const,
                        criteriosAdjudicacion: "COMPLETO" as const,
                        requisitosSolvencia: "COMPLETO" as const,
                        requisitosTecnicos: "COMPLETO" as const,
                        restriccionesYRiesgos: "COMPLETO" as const,
                        modeloServicio: "COMPLETO" as const
                    },
                    missingCriticalFields: [],
                    ambiguous_fields: [],
                    warnings: []
                },
                evidences: []
            }
        };

        expect(() => LicitacionAgentResponseSchema.parse(mockResponse)).not.toThrow();
    });
});
