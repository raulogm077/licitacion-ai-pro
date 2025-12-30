/**
 * Server-side OpenAI Workflow Mapper
 * 
 * Maps the raw JSON output from OpenAI Agent Builder workflow
 * to the LicitacionData schema format.
 */

import { LicitacionData } from '../shared/types';

/**
 * Agent Builder workflow output structure
 */
interface AgentOutput {
    result: {
        datosGenerales: {
            titulo: string;
            presupuesto: number;
            moneda: string;
            plazoEjecucionMeses: number;
            cpv: string[];
            organoContratacion: string;
        };
        criteriosAdjudicacion: {
            objetivos: string[];
            subjetivos: string[];
        };
        requisitosTecnicos: {
            funcionales: string[];
            normativa: string[];
        };
        requisitosSolvencia: {
            economica: {
                cifraNegocioAnualMinima: number;
                descripcion: string;
            };
            tecnica: string[];
        };
        restriccionesYRiesgos: {
            killCriteria: string[];
            riesgos: string[];
            penalizaciones: string[];
        };
        modeloServicio: {
            sla: string[];
            equipoMinimo: string[];
        };
    };
    workflow: {
        quality: {
            overall: 'COMPLETO' | 'PARCIAL' | 'VACIO';
            bySection: Record<string, 'COMPLETO' | 'PARCIAL' | 'VACIO'>;
            missingCriticalFields: string[];
            ambiguous_fields: string[];
            warnings: string[];
        };
        evidences: Array<{
            fieldPath: string;
            quote: string;
            evidences: Array<{
                fieldPath: string;
                quote: string;
                pageHint: string | null;
                confidence: number;
            }>;
            confidence: number;
        }>;
    };
}

/**
 * Maps OpenAI workflow output to LicitacionData schema
 * 
 * @param workflowOutput - Raw JSON from OpenAI Agent Builder workflow
 * @param readingMode - Reading mode: 'full' or 'keydata'
 * @returns Mapped data conforming to LicitacionData schema
 */
export function mapWorkflowToLicitacionData(
    workflowOutput: unknown
): Partial<LicitacionData> {
    // Validate input is an object
    if (!workflowOutput || typeof workflowOutput !== 'object') {
        throw new Error('Invalid workflow output: expected object');
    }

    const agentData = workflowOutput as AgentOutput;

    // Validate required structure
    if (!agentData.result) {
        throw new Error('Invalid workflow output: missing result field');
    }

    const { result, workflow } = agentData;

    // Map datosGenerales (always included)
    const mapped: Partial<LicitacionData> = {
        datosGenerales: {
            titulo: result.datosGenerales?.titulo || '',
            presupuesto: result.datosGenerales?.presupuesto || 0,
            moneda: result.datosGenerales?.moneda || 'EUR',
            plazoEjecucionMeses: result.datosGenerales?.plazoEjecucionMeses || 0,
            cpv: result.datosGenerales?.cpv || [],
            organoContratacion: result.datosGenerales?.organoContratacion || '',
            fechaLimitePresentacion: undefined, // Not provided by agent
        },
    };

    // Map criteriosAdjudicacion
    // Agent returns array of strings, we need to convert to objects with descripcion + ponderacion
    if (result.criteriosAdjudicacion) {
        mapped.criteriosAdjudicacion = {
            objetivos: (result.criteriosAdjudicacion.objetivos || []).map(desc => ({
                descripcion: desc,
                ponderacion: 0, // Agent doesn't extract ponderacion yet
                formula: undefined,
                cita: undefined,
            })),
            subjetivos: (result.criteriosAdjudicacion.subjetivos || []).map(desc => ({
                descripcion: desc,
                ponderacion: 0, // Agent doesn't extract ponderacion yet
                detalles: undefined,
                cita: undefined,
            })),
        };
    }

    // Map requisitosTecnicos
    if (result.requisitosTecnicos) {
        mapped.requisitosTecnicos = {
            funcionales: (result.requisitosTecnicos.funcionales || []).map(req => ({
                requisito: req,
                obligatorio: true, // Assume all extracted requirements are obligatory
                referenciaPagina: undefined,
                cita: undefined,
            })),
            normativa: (result.requisitosTecnicos.normativa || []).map(norma => ({
                norma,
                descripcion: undefined,
                cita: undefined,
            })),
        };
    }

    // Map requisitosSolvencia
    if (result.requisitosSolvencia) {
        mapped.requisitosSolvencia = {
            economica: {
                cifraNegocioAnualMinima: result.requisitosSolvencia.economica?.cifraNegocioAnualMinima || 0,
                descripcion: result.requisitosSolvencia.economica?.descripcion || undefined,
            },
            tecnica: (result.requisitosSolvencia.tecnica || []).map(desc => ({
                descripcion: desc,
                proyectosSimilaresRequeridos: 0,
                importeMinimoProyecto: undefined,
                cita: undefined,
            })),
        };
    }

    // Map restriccionesYRiesgos
    if (result.restriccionesYRiesgos) {
        mapped.restriccionesYRiesgos = {
            killCriteria: (result.restriccionesYRiesgos.killCriteria || []).map(criterio => ({
                criterio,
                justificacion: undefined,
                cita: undefined,
            })),
            riesgos: (result.restriccionesYRiesgos.riesgos || []).map(descripcion => ({
                descripcion,
                impacto: 'MEDIO' as const, // Default impact
                probabilidad: 'MEDIA' as const, // Default probability
                mitigacionSugerida: undefined,
                cita: undefined,
            })),
            penalizaciones: (result.restriccionesYRiesgos.penalizaciones || []).map(penalizacion => ({
                causa: penalizacion,
                sancion: '', // Agent doesn't separate cause/sanction
                cita: undefined,
            })),
        };
    }

    // Map modeloServicio
    if (result.modeloServicio) {
        mapped.modeloServicio = {
            sla: (result.modeloServicio.sla || []).map(metrica => ({
                metrica,
                objetivo: 'N/A',
                cita: undefined,
            })),
            equipoMinimo: (result.modeloServicio.equipoMinimo || []).map(rol => ({
                rol,
                experienciaAnios: 0,
                titulacion: undefined,
                cita: undefined,
            })),
        };
    }

    // Include workflow metadata if available
    if (workflow) {
        mapped.workflow = {
            quality: workflow.quality,
            steps: [], // Not provided by agent
            updated_at: new Date().toISOString(),
            status: workflow.quality?.overall === 'COMPLETO' ? 'succeeded' : 'failed',
            current_version: 1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            evidences: (workflow.evidences || []).map((e: any) => ({
                fieldPath: e.fieldPath,
                quote: e.quote,
                pageHint: e.pageHint,
                confidence: e.confidence
            }))
        };
    }


    return mapped;
}
