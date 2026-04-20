/**
 * Frontend Schemas — aligned with canonical backend schema.
 *
 * SOURCE OF TRUTH for types is the backend canonical schema.
 * This file mirrors those types with Zod for frontend validation,
 * plus backward-compat preprocessing for data already saved in DB.
 *
 * Conventions:
 * - Critical fields (titulo, presupuesto, moneda, plazo, cpv, organo)
 *   use TrackedField<T> with {value, evidence, status, warnings}.
 * - Non-critical fields are rich objects with optional 'cita'.
 * - Legacy data (strings instead of objects) is still accepted
 *   via z.preprocess + z.union for backward compat.
 */
import { z } from 'zod';
import {
    ANALYSIS_PARTIAL_REASONS,
    ANALYSIS_QUALITY_STATUSES,
    TRACKED_FIELD_STATUSES,
} from '../shared/analysis-contract';

// ─── Helpers (Robust parsing for backward compat) ─────────────────────────────

const RobustString = (defaultValue: string = '') =>
    z.preprocess(
        (val) => (val === null || val === undefined ? undefined : String(val)),
        z.string().default(defaultValue)
    );

const RobustNumber = (defaultValue: number = 0) =>
    z.preprocess((val) => {
        if (val === null || val === undefined) return defaultValue;
        const num = Number(val);
        return isNaN(num) ? defaultValue : num;
    }, z.number().default(defaultValue));

// ─── Field Status & Evidence ──────────────────────────────────────────────────

export const FieldStatusEnum = z.enum(TRACKED_FIELD_STATUSES);

export const EvidenceSchema = z.object({
    quote: z.string(),
    pageHint: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type FieldStatus = z.infer<typeof FieldStatusEnum>;

/**
 * TrackedField<T> — wrapper for critical fields.
 * Also accepts legacy flat values (string/number/array) and wraps them.
 */
function TrackedField<T extends z.ZodTypeAny>(valueSchema: T) {
    const objectForm = z.object({
        value: valueSchema,
        evidence: z.preprocess((val) => (val === null ? undefined : val), EvidenceSchema.optional()),
        status: FieldStatusEnum.default('extraido'),
        warnings: z.array(z.string()).optional(),
    });

    // Accept either the wrapped form or a raw value (backward compat)
    return z.preprocess((val) => {
        if (val === null || val === undefined) {
            return { value: valueSchema._def?.defaultValue?.() ?? undefined, status: 'no_encontrado' };
        }
        if (typeof val === 'object' && val !== null && 'value' in val) {
            return val; // Already wrapped
        }
        // Legacy flat value — wrap it
        return { value: val, status: 'extraido' };
    }, objectForm);
}

export type TrackedFieldType<T> = {
    value: T;
    evidence?: Evidence;
    status: FieldStatus;
    warnings?: string[];
};

// ─── Notes & Metadata (unchanged) ────────────────────────────────────────────

export const NoteSchema = z.object({
    id: z.string(),
    requirementIndex: z.number().optional(),
    text: z.string(),
    author: z.string(),
    timestamp: z.number(),
    type: z.enum(['NOTE', 'QUESTION', 'WARNING']),
});

export type Note = z.infer<typeof NoteSchema>;

export const MetadataSchema = z.object({
    tags: z.array(z.string()).default([]),
    cliente: z.string().optional(),
    importeAdjudicado: z.number().optional(),
    estado: z.enum(['PENDIENTE', 'ADJUDICADA', 'DESCARTADA', 'EN_REVISION']).optional(),
    fechaCreacion: z.number().optional(),
    ultimaModificacion: z.number().optional(),
    sectionStatus: z.record(z.enum(['success', 'failed', 'processing'])).optional(),
});

export type LicitacionMetadata = z.infer<typeof MetadataSchema>;

// ─── Datos Generales (critical fields with TrackedField) ──────────────────────

export const DatosGeneralesSchema = z.preprocess(
    (val) => val ?? {},
    z
        .object({
            titulo: TrackedField(z.string().default('Sin título')),
            organoContratacion: TrackedField(z.string().default('Desconocido')),
            presupuesto: TrackedField(RobustNumber(0)),
            moneda: TrackedField(z.string().default('EUR')),
            plazoEjecucionMeses: TrackedField(RobustNumber(0)),
            cpv: TrackedField(z.array(z.string()).default([])),
            fechaLimitePresentacion: z.string().optional().nullable(),
            tipoContrato: z.string().optional().nullable(),
            procedimiento: z.string().optional().nullable(),
        })
        .default({})
);

// ─── Económico ────────────────────────────────────────────────────────────────

export const EconomicoSchema = z.preprocess(
    (val) => val ?? {},
    z
        .object({
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
        })
        .default({})
);

// ─── Duración y Prórrogas ─────────────────────────────────────────────────────

export const DuracionYProrrogasSchema = z.preprocess(
    (val) => val ?? {},
    z
        .object({
            duracionMeses: z.number().optional().nullable(),
            prorrogaMeses: z.number().optional().nullable(),
            prorrogaMaxima: z.number().optional().nullable(),
            fechaInicio: z.string().optional().nullable(),
            fechaFin: z.string().optional().nullable(),
            observaciones: z.string().optional().nullable(),
            cita: z.string().optional(),
        })
        .default({})
);

// ─── Criterios de Adjudicación ────────────────────────────────────────────────

const CriterioSubjetivoSchema = z.object({
    descripcion: RobustString(''),
    ponderacion: RobustNumber(0),
    detalles: z.string().optional().nullable(),
    subcriterios: z
        .array(z.object({ descripcion: z.string(), ponderacion: z.number().default(0) }))
        .optional()
        .default([]),
    cita: z.string().optional(),
});

const CriterioObjetivoSchema = z.object({
    descripcion: RobustString(''),
    ponderacion: RobustNumber(0),
    formula: z.string().optional().nullable(),
    cita: z.string().optional(),
});

export const CriteriosAdjudicacionSchema = z.preprocess(
    (val) => val ?? {},
    z
        .object({
            subjetivos: z.preprocess(
                (val) => (val === null || val === undefined ? [] : val),
                z.array(CriterioSubjetivoSchema).default([])
            ),
            objetivos: z.preprocess(
                (val) => (val === null || val === undefined ? [] : val),
                z.array(CriterioObjetivoSchema).default([])
            ),
            umbralAnormalidad: z.string().optional().nullable(),
            cita: z.string().optional(),
        })
        .default({})
);

// ─── Requisitos de Solvencia ──────────────────────────────────────────────────

const SolvenciaTecnicaItemSchema = z.preprocess(
    (val) => {
        if (typeof val === 'string') return { descripcion: val, proyectosSimilaresRequeridos: 0 };
        return val;
    },
    z.object({
        descripcion: RobustString(''),
        proyectosSimilaresRequeridos: RobustNumber(0),
        importeMinimoProyecto: z.number().optional().nullable(),
        cita: z.string().optional(),
    })
);

export const RequisitosSolvenciaSchema = z.preprocess(
    (val) => val ?? {},
    z
        .object({
            economica: z.preprocess(
                (val) => val ?? {},
                z
                    .object({
                        cifraNegocioAnualMinima: RobustNumber(0),
                        descripcion: z.string().optional().nullable(),
                        cita: z.string().optional(),
                    })
                    .default({})
            ),
            tecnica: z.preprocess(
                (val) => (val === null || val === undefined ? [] : val),
                z.array(SolvenciaTecnicaItemSchema).default([])
            ),
            profesional: z
                .array(z.object({ descripcion: z.string(), cita: z.string().optional() }))
                .optional()
                .default([]),
        })
        .default({})
);

// ─── Requisitos Técnicos ──────────────────────────────────────────────────────

const RequisitoFuncionalItemSchema = z.preprocess(
    (val) => {
        if (typeof val === 'string') return { requisito: val, obligatorio: true };
        return val;
    },
    z.object({
        requisito: RobustString(''),
        obligatorio: z.preprocess((v) => v ?? true, z.boolean().default(true)),
        referenciaPagina: z.number().optional().nullable(),
        cita: z.string().optional(),
    })
);

const NormativaItemSchema = z.preprocess(
    (val) => {
        if (typeof val === 'string') return { norma: val };
        return val;
    },
    z.object({
        norma: RobustString(''),
        descripcion: z.string().optional().nullable(),
        cita: z.string().optional(),
    })
);

export const RequisitosTecnicosSchema = z.preprocess(
    (val) => val ?? {},
    z
        .object({
            funcionales: z.preprocess(
                (val) => (val === null || val === undefined ? [] : val),
                z.array(RequisitoFuncionalItemSchema).default([])
            ),
            normativa: z.preprocess(
                (val) => (val === null || val === undefined ? [] : val),
                z.array(NormativaItemSchema).default([])
            ),
        })
        .default({})
);

// ─── Restricciones y Riesgos ──────────────────────────────────────────────────

const KillCriterionSchema = z.preprocess(
    (val) => {
        if (typeof val === 'string') return { criterio: val };
        return val;
    },
    z.object({
        criterio: RobustString(''),
        justificacion: z.string().optional().nullable(),
        cita: z.string().optional(),
    })
);

const RiesgoSchema = z.object({
    descripcion: RobustString(''),
    impacto: z.preprocess(
        (val) => {
            if (val === null || val === undefined) return 'MEDIO';
            const s = String(val);
            return ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'].includes(s) ? s : 'MEDIO';
        },
        z.enum(['BAJO', 'MEDIO', 'ALTO', 'CRITICO']).default('MEDIO')
    ),
    probabilidad: z.preprocess(
        (val) => {
            if (val === null || val === undefined) return undefined;
            const s = String(val);
            return ['BAJA', 'MEDIA', 'ALTA'].includes(s) ? s : undefined;
        },
        z.enum(['BAJA', 'MEDIA', 'ALTA']).optional().nullable()
    ),
    mitigacionSugerida: z.string().optional().nullable(),
    cita: z.string().optional(),
});

const PenalizacionSchema = z.object({
    causa: RobustString(''),
    sancion: RobustString(''),
    cita: z.string().optional(),
});

export const RestriccionesYRiesgosSchema = z.preprocess(
    (val) => val ?? {},
    z
        .object({
            killCriteria: z.preprocess(
                (val) => (val === null || val === undefined ? [] : val),
                z.array(KillCriterionSchema).default([])
            ),
            riesgos: z.preprocess(
                (val) => (val === null || val === undefined ? [] : val),
                z.array(RiesgoSchema).default([])
            ),
            penalizaciones: z.preprocess(
                (val) => (val === null || val === undefined ? [] : val),
                z.array(PenalizacionSchema).default([])
            ),
        })
        .default({})
);

// ─── Modelo de Servicio ───────────────────────────────────────────────────────

const SLAItemSchema = z.preprocess(
    (val) => {
        if (typeof val === 'string') return { metrica: val, objetivo: 'N/A' };
        return val;
    },
    z.object({
        metrica: RobustString(''),
        objetivo: RobustString('N/A'),
        cita: z.string().optional(),
    })
);

const EquipoMinimoItemSchema = z.preprocess(
    (val) => {
        if (typeof val === 'string') return { rol: val, experienciaAnios: 0 };
        return val;
    },
    z.object({
        rol: RobustString(''),
        experienciaAnios: RobustNumber(0),
        titulacion: z.string().optional().nullable(),
        dedicacion: z.string().optional().nullable(),
        cita: z.string().optional(),
    })
);

export const ModeloServicioSchema = z.preprocess(
    (val) => val ?? {},
    z
        .object({
            sla: z.preprocess(
                (val) => (val === null || val === undefined ? [] : val),
                z.array(SLAItemSchema).default([])
            ),
            equipoMinimo: z.preprocess(
                (val) => (val === null || val === undefined ? [] : val),
                z.array(EquipoMinimoItemSchema).default([])
            ),
        })
        .default({})
);

// ─── Anexos y Observaciones ───────────────────────────────────────────────────

export const AnexosYObservacionesSchema = z.preprocess(
    (val) => val ?? {},
    z
        .object({
            anexosIdentificados: z
                .array(
                    z.object({
                        nombre: z.string(),
                        tipo: z.string().optional(),
                        relevancia: z.string().optional(),
                    })
                )
                .optional()
                .default([]),
            observaciones: z.array(z.string()).optional().default([]),
        })
        .default({})
);

// ─── LicitacionContent (Canonical Result) ─────────────────────────────────────

export const LicitacionContentSchema = z.object({
    plantilla_personalizada: z.record(z.any()).optional(),
    datosGenerales: DatosGeneralesSchema,
    economico: EconomicoSchema.optional(),
    duracionYProrrogas: DuracionYProrrogasSchema.optional(),
    criteriosAdjudicacion: CriteriosAdjudicacionSchema,
    requisitosSolvencia: RequisitosSolvenciaSchema,
    requisitosTecnicos: RequisitosTecnicosSchema,
    restriccionesYRiesgos: RestriccionesYRiesgosSchema,
    modeloServicio: ModeloServicioSchema,
    anexosYObservaciones: AnexosYObservacionesSchema.optional(),
});

export type LicitacionContent = z.infer<typeof LicitacionContentSchema>;

// ─── Quality & Workflow ───────────────────────────────────────────────────────

export const QualityStatusEnum = z.enum(ANALYSIS_QUALITY_STATUSES);
export const AnalysisPartialReasonEnum = z.enum(ANALYSIS_PARTIAL_REASONS);

export const QualitySchema = z.object({
    overall: QualityStatusEnum,
    bySection: z.record(QualityStatusEnum).default({}),
    missingCriticalFields: z.array(z.string()).default([]),
    ambiguous_fields: z.array(z.string()).default([]),
    warnings: z.array(z.string()).default([]),
    partial_reasons: z.array(AnalysisPartialReasonEnum).default([]),
    consistencyWarnings: z.array(z.string()).optional(),
});

export const WorkflowStateSchema = z.object({
    current_version: z.number().optional(),
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
        // Legacy statuses (backward compat)
        'uploaded',
        'requires_ocr',
        'ready',
        'queued',
        'running',
        'succeeded',
    ]),
    steps: z
        .array(
            z.object({
                name: z.string(),
                status: z.string(),
                error: z.string().nullable(),
            })
        )
        .optional()
        .default([]),
    quality: QualitySchema.optional(),
    evidences: z
        .array(
            z.object({
                fieldPath: z.string(),
                quote: z.string(),
                pageHint: z.string().optional().nullable(),
                confidence: z.number().optional(),
            })
        )
        .optional()
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
        .optional()
        .default({}),
    updated_at: z.string().optional(),
    created_at: z.string().optional(),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// ─── Analysis Version ─────────────────────────────────────────────────────────

export const AnalysisVersionSchema = z.object({
    version: z.number(),
    status: z.enum(['queued', 'running', 'succeeded', 'failed']),
    created_at: z.string(),
    model: z.string(),
    schema_version: z.string(),
    prompt_version: z.string(),
    guide_version: z.string().optional(),
    result: LicitacionContentSchema,
    workflow: z
        .object({
            steps: z.array(
                z.object({
                    name: z.string(),
                    status: z.string(),
                    error: z.string().nullable(),
                })
            ),
        })
        .optional(),
});

export type AnalysisVersion = z.infer<typeof AnalysisVersionSchema>;

// ─── LicitacionData (Full Envelope) ──────────────────────────────────────────

export const LicitacionSchema = LicitacionContentSchema.extend({
    result: LicitacionContentSchema.optional(),
    versions: z.array(AnalysisVersionSchema).optional(),
    workflow: WorkflowStateSchema.optional(),
    metadata: MetadataSchema.optional(),
    storage: z
        .object({
            pdf_path: z.string().optional(),
            chunks_path: z.string().optional(),
            text_path: z.string().optional(),
        })
        .optional(),
    notas: z.array(NoteSchema).optional(),
});

export type LicitacionData = z.infer<typeof LicitacionSchema>;

// ─── Template Schemas (unchanged) ─────────────────────────────────────────────

export const TemplateFieldSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['texto', 'numero', 'fecha', 'lista', 'booleano']),
    description: z.string().optional(),
    required: z.boolean().default(false),
});

export type TemplateField = z.infer<typeof TemplateFieldSchema>;

export const ExtractionTemplateSchema = z.object({
    id: z.string(),
    user_id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    schema: z.array(TemplateFieldSchema),
    created_at: z.string(),
    updated_at: z.string(),
});

export type ExtractionTemplate = z.infer<typeof ExtractionTemplateSchema>;
