/**
 * Schema Canónico del Análisis de Licitación
 *
 * SOURCE OF TRUTH para toda la aplicación.
 * Define la estructura completa del resultado de análisis.
 *
 * Convenciones:
 * - Campos CRÍTICOS (titulo, presupuesto, moneda, plazo, cpv, organo) usan TrackedField<T>
 *   con value, evidence, status y warnings.
 * - Campos no-críticos son objetos ricos con campo `cita` opcional.
 * - Evidencias globales adicionales van en workflow.evidences[].
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { z } from 'npm:zod@3.22.4';

// ─── Field Status & Evidence ──────────────────────────────────────────────────

export const FieldStatusEnum = z.enum(['extraido', 'ambiguo', 'no_encontrado', 'derivado_tecnico']);

export const EvidenceSchema = z.object({
    quote: z.string().describe('Extracto literal del pliego (max 240 chars)'),
    pageHint: z.string().optional().describe('Número de página si se puede inferir'),
    confidence: z.number().min(0).max(1).optional().describe('0..1'),
});

/** Wrapper para campos críticos con trazabilidad */
function TrackedField<T extends z.ZodTypeAny>(valueSchema: T) {
    return z.object({
        value: valueSchema,
        evidence: EvidenceSchema.optional(),
        status: FieldStatusEnum.default('extraido'),
        warnings: z.array(z.string()).optional(),
    });
}

export type Evidence = z.infer<typeof EvidenceSchema>;
export type FieldStatus = z.infer<typeof FieldStatusEnum>;

// ─── Datos Generales ──────────────────────────────────────────────────────────

export const DatosGeneralesSchema = z.object({
    titulo: TrackedField(z.string()),
    organoContratacion: TrackedField(z.string()),
    presupuesto: TrackedField(z.number()),
    moneda: TrackedField(z.string()),
    plazoEjecucionMeses: TrackedField(z.number()),
    cpv: TrackedField(z.array(z.string())),
    fechaLimitePresentacion: z.string().optional().nullable(),
    tipoContrato: z.string().optional().nullable(),
    procedimiento: z.string().optional().nullable(),
});

// ─── Económico ────────────────────────────────────────────────────────────────

export const EconomicoSchema = z.object({
    presupuestoBaseLicitacion: z.number().optional().nullable(),
    valorEstimadoContrato: z.number().optional().nullable(),
    importeIVA: z.number().optional().nullable(),
    tipoIVA: z.number().optional().nullable(),
    desglosePorLotes: z
        .array(
            z.object({
                lote: z.string(),
                descripcion: z.string().optional(),
                presupuesto: z.number(),
                cita: z.string().optional(),
            })
        )
        .optional()
        .default([]),
    moneda: z.string().default('EUR'),
    cita: z.string().optional(),
});

// ─── Duración y Prórrogas ─────────────────────────────────────────────────────

export const DuracionYProrrogasSchema = z.object({
    duracionMeses: z.number().optional().nullable(),
    prorrogaMeses: z.number().optional().nullable(),
    prorrogaMaxima: z.number().optional().nullable(),
    fechaInicio: z.string().optional().nullable(),
    fechaFin: z.string().optional().nullable(),
    observaciones: z.string().optional().nullable(),
    cita: z.string().optional(),
});

// ─── Criterios de Adjudicación ────────────────────────────────────────────────

export const CriterioSubjetivoSchema = z.object({
    descripcion: z.string(),
    ponderacion: z.number().default(0),
    detalles: z.string().optional().nullable(),
    subcriterios: z
        .array(
            z.object({
                descripcion: z.string(),
                ponderacion: z.number().default(0),
            })
        )
        .optional()
        .default([]),
    cita: z.string().optional(),
});

export const CriterioObjetivoSchema = z.object({
    descripcion: z.string(),
    ponderacion: z.number().default(0),
    formula: z.string().optional().nullable(),
    cita: z.string().optional(),
});

export const CriteriosAdjudicacionSchema = z.object({
    subjetivos: z.array(CriterioSubjetivoSchema).default([]),
    objetivos: z.array(CriterioObjetivoSchema).default([]),
    umbralAnormalidad: z.string().optional().nullable(),
    cita: z.string().optional(),
});

// ─── Requisitos de Solvencia ──────────────────────────────────────────────────

export const SolvenciaTecnicaSchema = z.object({
    descripcion: z.string(),
    proyectosSimilaresRequeridos: z.number().default(0),
    importeMinimoProyecto: z.number().optional().nullable(),
    cita: z.string().optional(),
});

export const RequisitosSolvenciaSchema = z.object({
    economica: z
        .object({
            cifraNegocioAnualMinima: z.number().default(0),
            descripcion: z.string().optional().nullable(),
            cita: z.string().optional(),
        })
        .default({}),
    tecnica: z.array(SolvenciaTecnicaSchema).default([]),
    profesional: z
        .array(
            z.object({
                descripcion: z.string(),
                cita: z.string().optional(),
            })
        )
        .optional()
        .default([]),
});

// ─── Requisitos Técnicos ──────────────────────────────────────────────────────

export const RequisitoFuncionalSchema = z.object({
    requisito: z.string(),
    obligatorio: z.boolean().default(true),
    referenciaPagina: z.number().optional().nullable(),
    cita: z.string().optional(),
});

export const NormativaSchema = z.object({
    norma: z.string(),
    descripcion: z.string().optional().nullable(),
    cita: z.string().optional(),
});

export const RequisitosTecnicosSchema = z.object({
    funcionales: z.array(RequisitoFuncionalSchema).default([]),
    normativa: z.array(NormativaSchema).default([]),
});

// ─── Restricciones y Riesgos ──────────────────────────────────────────────────

export const KillCriterionSchema = z.object({
    criterio: z.string(),
    justificacion: z.string().optional().nullable(),
    cita: z.string().optional(),
});

export const RiesgoSchema = z.object({
    descripcion: z.string(),
    impacto: z.enum(['BAJO', 'MEDIO', 'ALTO', 'CRITICO']).default('MEDIO'),
    probabilidad: z.enum(['BAJA', 'MEDIA', 'ALTA']).optional().nullable(),
    mitigacionSugerida: z.string().optional().nullable(),
    cita: z.string().optional(),
});

export const PenalizacionSchema = z.object({
    causa: z.string(),
    sancion: z.string(),
    cita: z.string().optional(),
});

export const RestriccionesYRiesgosSchema = z.object({
    killCriteria: z.array(KillCriterionSchema).default([]),
    riesgos: z.array(RiesgoSchema).default([]),
    penalizaciones: z.array(PenalizacionSchema).default([]),
});

// ─── Modelo de Servicio ───────────────────────────────────────────────────────

export const SLASchema = z.object({
    metrica: z.string(),
    objetivo: z.string(),
    cita: z.string().optional(),
});

export const EquipoMinimoSchema = z.object({
    rol: z.string(),
    experienciaAnios: z.number().default(0),
    titulacion: z.string().optional().nullable(),
    dedicacion: z.string().optional().nullable(),
    cita: z.string().optional(),
});

export const ModeloServicioSchema = z.object({
    sla: z.array(SLASchema).default([]),
    equipoMinimo: z.array(EquipoMinimoSchema).default([]),
});

// ─── Anexos y Observaciones ───────────────────────────────────────────────────

export const AnexosYObservacionesSchema = z.object({
    anexosIdentificados: z
        .array(
            z.object({
                nombre: z.string(),
                tipo: z.string().optional(),
                relevancia: z.string().optional(),
            })
        )
        .default([]),
    observaciones: z.array(z.string()).default([]),
});

// ─── Schema Canónico Completo ─────────────────────────────────────────────────

export const CanonicalResultSchema = z.object({
    plantilla_personalizada: z.record(z.any()).optional(),
    datosGenerales: DatosGeneralesSchema,
    economico: EconomicoSchema.default({}),
    duracionYProrrogas: DuracionYProrrogasSchema.default({}),
    criteriosAdjudicacion: CriteriosAdjudicacionSchema.default({}),
    requisitosSolvencia: RequisitosSolvenciaSchema.default({}),
    requisitosTecnicos: RequisitosTecnicosSchema.default({}),
    restriccionesYRiesgos: RestriccionesYRiesgosSchema.default({}),
    modeloServicio: ModeloServicioSchema.default({}),
    anexosYObservaciones: AnexosYObservacionesSchema.default({}),
});

export type CanonicalResult = z.infer<typeof CanonicalResultSchema>;

// ─── Quality & Workflow ───────────────────────────────────────────────────────

export const QualityStatusEnum = z.enum(['COMPLETO', 'PARCIAL', 'VACIO']);

export const QualitySchema = z.object({
    overall: QualityStatusEnum,
    bySection: z.record(QualityStatusEnum).default({}),
    missingCriticalFields: z.array(z.string()).default([]),
    ambiguous_fields: z.array(z.string()).default([]),
    warnings: z.array(z.string()).default([]),
});

export const WorkflowSchema = z.object({
    status: z.enum([
        'pending',
        'ingestion',
        'document_map',
        'extraction',
        'consolidation',
        'validation',
        'completed',
        'failed',
        'partial',
    ]),
    quality: QualitySchema.optional(),
    evidences: z
        .array(
            EvidenceSchema.extend({
                fieldPath: z.string(),
            })
        )
        .default([]),
    phases: z
        .record(
            z.object({
                status: z.enum(['pending', 'running', 'completed', 'failed']),
                startedAt: z.string().optional(),
                completedAt: z.string().optional(),
                error: z.string().optional(),
            })
        )
        .default({}),
    updated_at: z.string(),
    created_at: z.string().optional(),
});

export type Quality = z.infer<typeof QualitySchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;

// ─── Full Analysis Response (result + workflow) ───────────────────────────────

export const AnalysisResponseSchema = z.object({
    result: CanonicalResultSchema,
    workflow: WorkflowSchema,
});

export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;
