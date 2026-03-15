import { z } from 'zod';

/**
 * Schema SIMPLIFICADO para el Agent (compatible con Agents SDK)
 * 
 * IMPORTANTE: Este schema es lo que el Agent devolverá.
 * Luego se transformará al schema complejo del frontend.
 *
 * UPDATE: Made fields optional/nullable for robustness
 */

// Datos Generales (simplificado)
export const DatosGeneralesAgentSchema = z.object({
    titulo: z.string().describe("Título completo de la licitación").optional().default(""),
    presupuesto: z.number().describe("Presupuesto base sin IVA en EUR").optional().default(0),
    moneda: z.string().default("EUR").optional(),
    plazoEjecucionMeses: z.number().describe("Duración en meses").optional().default(0),
    cpv: z.array(z.string()).describe("Códigos CPV identificados").optional().default([]),
    organoContratacion: z.string().describe("Entidad contratante").optional().default(""),
    fechaLimitePresentacion: z.string().optional().describe("Fecha límite ISO 8601")
});

// Criterios (simplificado - arrays de strings)
export const CriteriosAgentSchema = z.object({
    subjetivos: z.array(z.string()).describe("Criterios de juicio de valor").optional().default([]),
    objetivos: z.array(z.string()).describe("Criterios automáticos con fórmula").optional().default([])
});

// Requisitos Técnicos (simplificado)
export const RequisitosTecnicosAgentSchema = z.object({
    funcionales: z.array(z.string()).describe("Requisitos funcionales identificados").optional().default([]),
    normativa: z.array(z.string()).describe("Normativa aplicable").optional().default([])
});

// Solvencia (simplificado)
export const SolvenciaAgentSchema = z.object({
    economica: z.object({
        cifraNegocioAnualMinima: z.number().optional().default(0),
        descripcion: z.string().optional().default("")
    }).optional().default({}),
    tecnica: z.array(z.string()).optional().default([])
});

// Riesgos (simplificado)
export const RiesgosAgentSchema = z.object({
    killCriteria: z.array(z.string()).describe("Criterios excluyentes").optional().default([]),
    riesgos: z.array(z.string()).describe("Riesgos identificados").optional().default([]),
    penalizaciones: z.array(z.string()).describe("Penalizaciones aplicables").optional().default([])
});

// Modelo Servicio (simplificado)
export const ModeloServicioAgentSchema = z.object({
    sla: z.array(z.string()).describe("SLAs requeridos").optional().default([]),
    equipoMinimo: z.array(z.string()).describe("Perfiles mínimos del equipo").optional().default([])
});

// Result completo
export const ResultAgentSchema = z.object({
    datosGenerales: DatosGeneralesAgentSchema.optional().default({}),
    criteriosAdjudicacion: CriteriosAgentSchema.optional().default({}),
    requisitosTecnicos: RequisitosTecnicosAgentSchema.optional().default({}),
    requisitosSolvencia: SolvenciaAgentSchema.optional().default({}),
    restriccionesYRiesgos: RiesgosAgentSchema.optional().default({}),
    modeloServicio: ModeloServicioAgentSchema.optional().default({})
});

// Workflow metadata
export const WorkflowAgentSchema = z.object({
    quality: z.object({
        overall: z.enum(["COMPLETO", "PARCIAL", "VACIO"]).optional().default("PARCIAL"),
        bySection: z.object({
            datosGenerales: z.enum(["COMPLETO", "PARCIAL", "VACIO"]).optional().default("PARCIAL"),
            criteriosAdjudicacion: z.enum(["COMPLETO", "PARCIAL", "VACIO"]).optional().default("PARCIAL"),
            requisitosSolvencia: z.enum(["COMPLETO", "PARCIAL", "VACIO"]).optional().default("PARCIAL"),
            requisitosTecnicos: z.enum(["COMPLETO", "PARCIAL", "VACIO"]).optional().default("PARCIAL"),
            restriccionesYRiesgos: z.enum(["COMPLETO", "PARCIAL", "VACIO"]).optional().default("PARCIAL"),
            modeloServicio: z.enum(["COMPLETO", "PARCIAL", "VACIO"]).optional().default("PARCIAL")
        }).optional().default({}),
        missingCriticalFields: z.array(z.string()).optional().default([]),
        ambiguous_fields: z.array(z.string()).optional().default([]),
        warnings: z.array(z.string()).optional().default([])
    }).optional().default({}),
    evidences: z.array(z.object({
        fieldPath: z.string(),
        quote: z.string(),
        pageHint: z.string().optional(),
        confidence: z.number().optional()
    })).optional().default([])
});

// Schema completo para Agent response
export const LicitacionAgentResponseSchema = z.object({
    result: ResultAgentSchema,
    workflow: WorkflowAgentSchema.optional().default({})
});

export type LicitacionAgentResponse = z.infer<typeof LicitacionAgentResponseSchema>;
