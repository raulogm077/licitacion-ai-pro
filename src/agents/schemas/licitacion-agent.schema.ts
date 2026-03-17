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
    titulo: z.string().describe("Título completo de la licitación").optional().nullable().default(""),
    presupuesto: z.number().describe("Presupuesto base sin IVA en EUR").optional().nullable().default(0),
    moneda: z.string().default("EUR").optional().nullable(),
    plazoEjecucionMeses: z.number().describe("Duración en meses").optional().nullable().default(0),
    cpv: z.array(z.string()).describe("Códigos CPV identificados").optional().nullable().default([]),
    organoContratacion: z.string().describe("Entidad contratante").optional().nullable().default(""),
    fechaLimitePresentacion: z.string().optional().nullable().describe("Fecha límite ISO 8601")
});

// Criterios (simplificado - arrays de strings)
export const CriteriosAgentSchema = z.object({
    subjetivos: z.array(z.string()).describe("Criterios de juicio de valor").optional().nullable().default([]),
    objetivos: z.array(z.string()).describe("Criterios automáticos con fórmula").optional().nullable().default([])
});

// Requisitos Técnicos (simplificado)
export const RequisitosTecnicosAgentSchema = z.object({
    funcionales: z.array(z.string()).describe("Requisitos funcionales identificados").optional().nullable().default([]),
    normativa: z.array(z.string()).describe("Normativa aplicable").optional().nullable().default([])
});

// Solvencia (simplificado)
export const SolvenciaAgentSchema = z.object({
    economica: z.object({
        cifraNegocioAnualMinima: z.number().optional().nullable().default(0),
        descripcion: z.string().optional().nullable().default("")
    }).optional().nullable().default({}),
    tecnica: z.array(z.string()).optional().nullable().default([])
});

// Riesgos (simplificado)
export const RiesgosAgentSchema = z.object({
    killCriteria: z.array(z.string()).describe("Criterios excluyentes").optional().nullable().default([]),
    riesgos: z.array(z.string()).describe("Riesgos identificados").optional().nullable().default([]),
    penalizaciones: z.array(z.string()).describe("Penalizaciones aplicables").optional().nullable().default([])
});

// Modelo Servicio (simplificado)
export const ModeloServicioAgentSchema = z.object({
    sla: z.array(z.string()).describe("SLAs requeridos").optional().nullable().default([]),
    equipoMinimo: z.array(z.string()).describe("Perfiles mínimos del equipo").optional().nullable().default([])
});

// Result completo
export const ResultAgentSchema = z.object({
    plantilla_personalizada: z.record(z.any()).optional().nullable(),
    datosGenerales: DatosGeneralesAgentSchema.optional().nullable().default({}),
    criteriosAdjudicacion: CriteriosAgentSchema.optional().nullable().default({}),
    requisitosTecnicos: RequisitosTecnicosAgentSchema.optional().nullable().default({}),
    requisitosSolvencia: SolvenciaAgentSchema.optional().nullable().default({}),
    restriccionesYRiesgos: RiesgosAgentSchema.optional().nullable().default({}),
    modeloServicio: ModeloServicioAgentSchema.optional().nullable().default({})
});

// Workflow metadata
export const WorkflowAgentSchema = z.object({
    quality: z.object({
        overall: z.enum(["COMPLETO", "PARCIAL", "VACIO"]).optional().nullable().default("PARCIAL"),
        bySection: z.object({
            datosGenerales: z.enum(["COMPLETO", "PARCIAL", "VACIO"]).optional().nullable().default("PARCIAL"),
            criteriosAdjudicacion: z.enum(["COMPLETO", "PARCIAL", "VACIO"]).optional().nullable().default("PARCIAL"),
            requisitosSolvencia: z.enum(["COMPLETO", "PARCIAL", "VACIO"]).optional().nullable().default("PARCIAL"),
            requisitosTecnicos: z.enum(["COMPLETO", "PARCIAL", "VACIO"]).optional().nullable().default("PARCIAL"),
            restriccionesYRiesgos: z.enum(["COMPLETO", "PARCIAL", "VACIO"]).optional().nullable().default("PARCIAL"),
            modeloServicio: z.enum(["COMPLETO", "PARCIAL", "VACIO"]).optional().nullable().default("PARCIAL")
        }).optional().nullable().default({}),
        missingCriticalFields: z.array(z.string()).optional().nullable().default([]),
        ambiguous_fields: z.array(z.string()).optional().nullable().default([]),
        warnings: z.array(z.string()).optional().nullable().default([])
    }).optional().nullable().default({}),
    evidences: z.array(z.object({
        fieldPath: z.string(),
        quote: z.string(),
        pageHint: z.string().optional().nullable(),
        confidence: z.number().optional().nullable()
    })).optional().nullable().default([])
});

// Schema completo para Agent response
export const LicitacionAgentResponseSchema = z.object({
    result: ResultAgentSchema,
    workflow: WorkflowAgentSchema.optional().nullable().default({})
});

export type LicitacionAgentResponse = z.infer<typeof LicitacionAgentResponseSchema>;
