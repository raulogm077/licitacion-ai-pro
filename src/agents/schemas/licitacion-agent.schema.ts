import { z } from 'zod';

/**
 * Schema SIMPLIFICADO para el Agent (compatible con Agents SDK)
 * 
 * IMPORTANTE: Este schema es lo que el Agent devolverá.
 * Luego se transformará al schema complejo del frontend.
 */

// Datos Generales (simplificado)
export const DatosGeneralesAgentSchema = z.object({
    titulo: z.string().describe("Título completo de la licitación"),
    presupuesto: z.number().describe("Presupuesto base sin IVA en EUR"),
    moneda: z.string().default("EUR"),
    plazoEjecucionMeses: z.number().describe("Duración en meses"),
    cpv: z.array(z.string()).describe("Códigos CPV identificados"),
    organoContratacion: z.string().describe("Entidad contratante"),
    fechaLimitePresentacion: z.string().optional().describe("Fecha límite ISO 8601")
});

// Criterios (simplificado - arrays de strings)
export const CriteriosAgentSchema = z.object({
    subjetivos: z.array(z.string()).describe("Criterios de juicio de valor"),
    objetivos: z.array(z.string()).describe("Criterios automáticos con fórmula")
});

// Requisitos Técnicos (simplificado)
export const RequisitosTecnicosAgentSchema = z.object({
    funcionales: z.array(z.string()).describe("Requisitos funcionales identificados"),
    normativa: z.array(z.string()).describe("Normativa aplicable")
});

// Solvencia (simplificado)
export const SolvenciaAgentSchema = z.object({
    economica: z.object({
        cifraNegocioAnualMinima: z.number(),
        descripcion: z.string()
    }),
    tecnica: z.array(z.string())
});

// Riesgos (simplificado)
export const RiesgosAgentSchema = z.object({
    killCriteria: z.array(z.string()).describe("Criterios excluyentes"),
    riesgos: z.array(z.string()).describe("Riesgos identificados"),
    penalizaciones: z.array(z.string()).describe("Penalizaciones aplicables")
});

// Modelo Servicio (simplificado)
export const ModeloServicioAgentSchema = z.object({
    sla: z.array(z.string()).describe("SLAs requeridos"),
    equipoMinimo: z.array(z.string()).describe("Perfiles mínimos del equipo")
});

// Result completo
export const ResultAgentSchema = z.object({
    datosGenerales: DatosGeneralesAgentSchema,
    criteriosAdjudicacion: CriteriosAgentSchema,
    requisitosTecnicos: RequisitosTecnicosAgentSchema,
    requisitosSolvencia: SolvenciaAgentSchema,
    restriccionesYRiesgos: RiesgosAgentSchema,
    modeloServicio: ModeloServicioAgentSchema
});

// Workflow metadata
export const WorkflowAgentSchema = z.object({
    quality: z.object({
        overall: z.enum(["COMPLETO", "PARCIAL", "VACIO"]),
        bySection: z.object({
            datosGenerales: z.enum(["COMPLETO", "PARCIAL", "VACIO"]),
            criteriosAdjudicacion: z.enum(["COMPLETO", "PARCIAL", "VACIO"]),
            requisitosSolvencia: z.enum(["COMPLETO", "PARCIAL", "VACIO"]),
            requisitosTecnicos: z.enum(["COMPLETO", "PARCIAL", "VACIO"]),
            restriccionesYRiesgos: z.enum(["COMPLETO", "PARCIAL", "VACIO"]),
            modeloServicio: z.enum(["COMPLETO", "PARCIAL", "VACIO"])
        }),
        missingCriticalFields: z.array(z.string()),
        ambiguous_fields: z.array(z.string()),
        warnings: z.array(z.string())
    }),
    evidences: z.array(z.object({
        fieldPath: z.string(),
        quote: z.string(),
        pageHint: z.string(),
        confidence: z.number()
    }))
});

// Schema completo para Agent response
export const LicitacionAgentResponseSchema = z.object({
    result: ResultAgentSchema,
    workflow: WorkflowAgentSchema
});

export type LicitacionAgentResponse = z.infer<typeof LicitacionAgentResponseSchema>;
