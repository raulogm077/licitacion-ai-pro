
import { z } from "zod";

// 1. Sub-sections
const DatosGeneralesSchema = z.object({
    titulo: z.string(),
    presupuesto: z.number().describe("Presupuesto base de licitación sin impuestos"),
    moneda: z.string().default("EUR"),
    plazoEjecucionMeses: z.number(),
    cpv: z.array(z.string()).describe("Códigos CPV encontrados"),
    organoContratacion: z.string(),
});

const CriteriosSchema = z.object({
    objetivos: z.array(z.string()).describe("Criterios evaluables mediante fórmulas"),
    subjetivos: z.array(z.string()).describe("Criterios dependientes de juicio de valor"),
});

const RequisitosTecnicosSchema = z.object({
    funcionales: z.array(z.string()),
    normativa: z.array(z.string()),
});

const SolvenciaSchema = z.object({
    economica: z.object({
        cifraNegocioAnualMinima: z.number(),
        descripcion: z.string(),
    }),
    tecnica: z.array(z.string()),
});

const RiesgosSchema = z.object({
    killCriteria: z.array(z.string()).describe("Requisitos excluyentes o 'knock-out'"),
    riesgos: z.array(z.string()),
    penalizaciones: z.array(z.string()),
});

const ModeloServicioSchema = z.object({
    sla: z.array(z.string()),
    equipoMinimo: z.array(z.string()),
});

// Metadata schema for Quality and Evidence
const WorkflowMetaSchema = z.object({
    quality: z.object({
        overall: z.string(),
        bySection: z.object({
            datosGenerales: z.string(),
            criteriosAdjudicacion: z.string(),
            requisitosSolvencia: z.string(),
            requisitosTecnicos: z.string(),
            restriccionesYRiesgos: z.string(),
            modeloServicio: z.string(),
        }),
        missingCriticalFields: z.array(z.string()),
        ambiguous_fields: z.array(z.string()),
        warnings: z.array(z.string()),
    }),
    evidences: z.array(z.object({
        fieldPath: z.string(),
        quote: z.string(),
        pageHint: z.string().default(""),
        confidence: z.number(),
    })),
});

// 2. Main Schema (The contract)
export const LicitacionResponseSchema = z.object({
    result: z.object({
        datosGenerales: DatosGeneralesSchema,
        criteriosAdjudicacion: CriteriosSchema,
        requisitosTecnicos: RequisitosTecnicosSchema,
        requisitosSolvencia: SolvenciaSchema,
        restriccionesYRiesgos: RiesgosSchema,
        modeloServicio: ModeloServicioSchema,
    }),
    workflow: WorkflowMetaSchema,
});

export type LicitacionResponse = z.infer<typeof LicitacionResponseSchema>;
