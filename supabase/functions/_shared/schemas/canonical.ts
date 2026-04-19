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

/**
 * Safely coerce to number. Returns `fallback` (default 0) instead of NaN.
 * Also unwraps TrackedField-like objects ({ value, status }) to their .value.
 * Use this everywhere z.coerce.number() would produce NaN for LLM text outputs.
 */
function safeCoerceNumber(fallback: number | null = 0) {
    return z.preprocess((v) => {
        if (v === null || v === undefined) return fallback;
        // Unwrap TrackedField if the LLM accidentally wraps a numeric field
        if (typeof v === 'object' && !Array.isArray(v) && 'value' in (v as object)) {
            v = (v as Record<string, unknown>).value;
            if (v === null || v === undefined) return fallback;
        }
        const n = Number(v);
        return isNaN(n) ? fallback : n;
    }, z.number().nullable());
}

/**
 * Safely coerce to string. Unwraps TrackedField objects to their .value.
 * Converts null/undefined to null.
 */
function safeCoerceString() {
    return z.preprocess((v) => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'object' && !Array.isArray(v) && 'value' in (v as object)) {
            v = (v as Record<string, unknown>).value;
            if (v === null || v === undefined) return null;
        }
        return String(v);
    }, z.string().nullable().optional());
}

/**
 * Safely coerce to string array. Accepts arrays, comma/newline/semicolon-separated
 * strings, or TrackedField wrappers and always returns a normalized string array.
 */
function safeCoerceStringArray() {
    return z.preprocess((v) => {
        if (v === null || v === undefined) return [];
        if (typeof v === 'object' && !Array.isArray(v) && 'value' in (v as object)) {
            v = (v as Record<string, unknown>).value;
            if (v === null || v === undefined) return [];
        }

        if (Array.isArray(v)) {
            return v
                .map((entry) => String(entry).trim())
                .filter((entry) => entry.length > 0);
        }

        if (typeof v === 'string') {
            return v
                .split(/[\n,;|]+/)
                .map((entry) => entry.trim())
                .filter((entry) => entry.length > 0);
        }

        return [String(v).trim()].filter((entry) => entry.length > 0);
    }, z.array(z.string()));
}

export const EvidenceSchema = z.object({
    quote: z.string().describe('Extracto literal del pliego (max 240 chars)'),
    pageHint: z.string().optional().describe('Número de página si se puede inferir'),
    confidence: z.number().min(0).max(1).optional().describe('0..1'),
});

/**
 * Wrapper para campos críticos con trazabilidad.
 * Acepta tres formas de entrada del modelo:
 *   1. TrackedField completo: { value, status, ... }             → pass-through
 *   2. Valor primitivo/array sin envolver: "texto" / 1000 / []  → wraps automáticamente
 *   3. Objeto sin .value o null/undefined                       → status: no_encontrado
 */
function TrackedField<T extends z.ZodTypeAny>(valueSchema: T) {
    return z.preprocess(
        (input) => {
            if (input === null || input === undefined) {
                return { value: null, status: 'no_encontrado', warnings: [] };
            }
            // Ya tiene formato TrackedField correcto
            if (typeof input === 'object' && !Array.isArray(input) && 'value' in (input as object)) {
                return input;
            }
            // Valor primitivo o array sin envolver — el modelo lo devolvió sin wrapper
            if (typeof input !== 'object' || Array.isArray(input)) {
                return { value: input, status: 'extraido', warnings: [] };
            }
            // Objeto sin .value (p.ej. { status: 'no_encontrado' })
            const obj = input as Record<string, unknown>;
            return { ...obj, value: null, status: obj.status ?? 'no_encontrado', warnings: obj.warnings ?? [] };
        },
        z.object({
            value: valueSchema.nullable(),
            evidence: z.preprocess((v) => (v === null ? undefined : v), EvidenceSchema.optional()),
            status: FieldStatusEnum.default('extraido'),
            warnings: z.array(z.string()).default([]),
        })
    );
}

export type Evidence = z.infer<typeof EvidenceSchema>;
export type FieldStatus = z.infer<typeof FieldStatusEnum>;

// ─── Datos Generales ──────────────────────────────────────────────────────────

/**
 * Extrae el valor de un TrackedField si el modelo lo devolvió envuelto
 * en campos que el schema espera como strings planos.
 */
const unwrapTracked = (v: unknown): unknown =>
    v !== null &&
    v !== undefined &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    'value' in (v as Record<string, unknown>)
        ? (v as Record<string, unknown>).value
        : v;

export const DatosGeneralesSchema = z.object({
    titulo: TrackedField(z.string()),
    organoContratacion: TrackedField(z.string()),
    // safeCoerceNumber evita NaN cuando el LLM devuelve texto o valores mal formados
    presupuesto: TrackedField(safeCoerceNumber(0)),
    moneda: TrackedField(z.string()),
    plazoEjecucionMeses: TrackedField(safeCoerceNumber(0)),
    cpv: TrackedField(safeCoerceStringArray()),
    // El modelo a veces envuelve estos en TrackedField; unwrapTracked lo normaliza
    fechaLimitePresentacion: z.preprocess(unwrapTracked, z.string().optional().nullable()),
    tipoContrato: z.preprocess(unwrapTracked, z.string().optional().nullable()),
    procedimiento: z.preprocess(unwrapTracked, z.string().optional().nullable()),
});

// ─── Económico ────────────────────────────────────────────────────────────────

export const EconomicoSchema = z.object({
    presupuestoBaseLicitacion: safeCoerceNumber(null),
    valorEstimadoContrato: safeCoerceNumber(null),
    importeIVA: safeCoerceNumber(null),
    tipoIVA: safeCoerceNumber(null),
    desglosePorLotes: z
        .array(
            z.object({
                lote: z.string(),
                descripcion: z.string().optional(),
                presupuesto: safeCoerceNumber(0),
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
    duracionMeses: safeCoerceNumber(null),
    prorrogaMeses: safeCoerceNumber(null),
    prorrogaMaxima: safeCoerceNumber(null),
    fechaInicio: z.string().optional().nullable(),
    fechaFin: z.string().optional().nullable(),
    observaciones: z.string().optional().nullable(),
    cita: z.string().optional(),
});

// ─── Criterios de Adjudicación ────────────────────────────────────────────────

export const CriterioSubjetivoSchema = z.object({
    descripcion: z.string(),
    ponderacion: safeCoerceNumber(0),
    detalles: z.string().optional().nullable(),
    subcriterios: z.preprocess(
        (v) => (v === null ? undefined : v),
        z
            .array(
                z.object({
                    descripcion: z.string(),
                    ponderacion: safeCoerceNumber(0),
                })
            )
            .optional()
            .default([])
    ),
    cita: z.string().optional(),
});

export const CriterioObjetivoSchema = z.object({
    descripcion: z.string(),
    ponderacion: safeCoerceNumber(0),
    formula: z.string().optional().nullable(),
    cita: z.string().optional(),
});

export const CriteriosAdjudicacionSchema = z.object({
    subjetivos: z.array(CriterioSubjetivoSchema).default([]),
    objetivos: z.array(CriterioObjetivoSchema).default([]),
    // LLM sometimes returns an object {value, status} here — unwrap it safely
    umbralAnormalidad: safeCoerceString(),
    cita: z.string().optional(),
});

// ─── Requisitos de Solvencia ──────────────────────────────────────────────────

export const SolvenciaTecnicaSchema = z.object({
    descripcion: z.string(),
    // LLM may return "N/A" or text → safeCoerceNumber avoids NaN
    proyectosSimilaresRequeridos: safeCoerceNumber(0),
    importeMinimoProyecto: safeCoerceNumber(null),
    cita: z.string().optional(),
});

export const RequisitosSolvenciaSchema = z.object({
    economica: z
        .object({
            // LLM may return "No especificado" or similar → safeCoerceNumber avoids NaN
            cifraNegocioAnualMinima: safeCoerceNumber(0),
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
    // LLM returns strings like "p. 5" or "página 5" — parse to int, null if unparseable
    referenciaPagina: z.preprocess((v) => {
        if (v === null || v === undefined) return null;
        const n = parseInt(String(v).replace(/\D/g, ''), 10);
        return isNaN(n) ? null : n;
    }, z.number().optional().nullable()),
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
    // LLM may return "No especificado" or similar text → safeCoerceNumber avoids NaN
    experienciaAnios: safeCoerceNumber(0),
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
