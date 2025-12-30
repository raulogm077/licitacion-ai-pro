// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { z } from 'zod';

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

// Helper: Handles null/undefined -> default value
const RobustString = (defaultValue: string = "") =>
    z.preprocess(val => (val === null || val === undefined) ? undefined : String(val), z.string().default(defaultValue));

// Helper: Handles null/undefined/NaN -> default number
const RobustNumber = (defaultValue: number = 0) =>
    z.preprocess(val => {
        if (val === null || val === undefined) return defaultValue;
        const num = Number(val);
        return isNaN(num) ? defaultValue : num;
    }, z.number().default(defaultValue));

// Helper: Handles null/undefined -> default boolean
const RobustBoolean = (defaultValue: boolean = false) =>
    z.preprocess(val => (val === null || val === undefined) ? defaultValue : Boolean(val), z.boolean().default(defaultValue));

// Helper: Handles null/undefined/invalid -> default enum value
const RobustEnum = <T extends [string, ...string[]]>(values: T, defaultValue: T[number]) =>
    z.preprocess(val => {
        if (val === null || val === undefined) return defaultValue;
        const strVal = String(val);
        // Case-insensitive match check? Or just strict check?
        // Let's try strict first, but fallback to default if not found
        return values.includes(strVal) ? strVal : defaultValue;
    }, z.enum(values).default(defaultValue));

// Helper: Handles null/undefined -> empty array
const RobustArray = <T extends z.ZodTypeAny>(schema: T) =>
    z.preprocess(val => (val === null || val === undefined) ? [] : val, z.array(schema).default([]));

export const LicitacionContentSchema = z.object({
    datosGenerales: z.preprocess(val => val ?? {}, z.object({
        titulo: RobustString('Sin título'),
        presupuesto: RobustNumber(0),
        moneda: RobustString("EUR"),
        plazoEjecucionMeses: RobustNumber(0),
        cpv: RobustArray(z.string()),
        organoContratacion: RobustString('Desconocido'),
        fechaLimitePresentacion: z.string().optional(),
    }).default({})),
    criteriosAdjudicacion: z.preprocess(val => val ?? {}, z.object({
        subjetivos: RobustArray(z.object({
            descripcion: RobustString(""),
            ponderacion: RobustNumber(0),
            detalles: z.string().optional(),
            cita: z.string().optional(),
        })),
        objetivos: RobustArray(z.object({
            descripcion: RobustString(""),
            ponderacion: RobustNumber(0),
            formula: z.string().optional(),
            cita: z.string().optional(),
        })),
    }).default({})),
    requisitosTecnicos: z.preprocess(val => val ?? {}, z.object({
        funcionales: RobustArray(
            z.union([
                z.string().transform(str => ({ requisito: str, obligatorio: true, referenciaPagina: undefined, cita: undefined })),
                z.object({
                    requisito: RobustString(""),
                    obligatorio: RobustBoolean(true),
                    referenciaPagina: z.number().optional(),
                    cita: z.string().optional()
                })
            ])
        ),
        normativa: RobustArray(
            z.union([
                z.string().transform(str => ({ norma: str, descripcion: undefined, cita: undefined })),
                z.object({
                    norma: RobustString(""),
                    descripcion: z.string().optional(),
                    cita: z.string().optional()
                })
            ])
        ),
    }).default({})),
    requisitosSolvencia: z.preprocess(val => val ?? {}, z.object({
        economica: z.preprocess(val => val ?? {}, z.object({
            cifraNegocioAnualMinima: RobustNumber(0),
            descripcion: z.string().optional().nullable().transform(val => val ?? undefined)
        }).catch({ cifraNegocioAnualMinima: 0, descripcion: undefined })).default({}),
        tecnica: RobustArray(z.union([
            z.string().transform(str => ({ descripcion: str, proyectosSimilaresRequeridos: 0, importeMinimoProyecto: undefined, cita: undefined })),
            z.object({
                descripcion: RobustString(""),
                proyectosSimilaresRequeridos: RobustNumber(0),
                importeMinimoProyecto: z.number().optional(),
                cita: z.string().optional()
            })
        ]))
    }).default({})),
    restriccionesYRiesgos: z.preprocess(val => val ?? {}, z.object({
        killCriteria: RobustArray(z.union([
            z.string().transform(str => ({ criterio: str, justificacion: "", cita: "" })),
            z.object({
                criterio: RobustString(""),
                justificacion: z.string().optional(),
                cita: z.string().optional()
            })
        ])),
        riesgos: RobustArray(z.object({
            descripcion: RobustString(""),
            impacto: RobustEnum(['BAJO', 'MEDIO', 'ALTO', 'CRITICO'] as const, 'MEDIO'),
            probabilidad: RobustEnum(['BAJA', 'MEDIA', 'ALTA'] as const, 'MEDIA').optional(),
            mitigacionSugerida: z.string().optional(),
            cita: z.string().optional(),
        })),
        penalizaciones: RobustArray(z.object({
            causa: RobustString(""),
            sancion: RobustString(""),
            cita: z.string().optional(),
        })),
    }).default({})),
    modeloServicio: z.preprocess(val => val ?? {}, z.object({
        sla: RobustArray(
            z.union([
                z.string().transform(str => ({ metrica: str, objetivo: "N/A", cita: undefined })),
                z.object({
                    metrica: RobustString(""),
                    objetivo: RobustString("N/A"),
                    cita: z.string().optional()
                })
            ])
        ),
        equipoMinimo: RobustArray(
            z.union([
                z.string().transform(str => ({ rol: str, experienciaAnios: 0, titulacion: undefined, cita: undefined })),
                z.object({
                    rol: RobustString(""),
                    experienciaAnios: RobustNumber(0),
                    titulacion: z.string().optional(),
                    cita: z.string().optional()
                })
            ])
        )
    }).default({}))
});

export type LicitacionContent = z.infer<typeof LicitacionContentSchema>;

export const AnalysisVersionSchema = z.object({
    version: z.number(),
    status: z.enum(['queued', 'running', 'succeeded', 'failed']),
    created_at: z.string(),
    model: z.string(),
    schema_version: z.string(),
    prompt_version: z.string(),
    guide_version: z.string().optional(),
    result: LicitacionContentSchema,
    workflow: z.object({
        steps: z.array(z.object({
            name: z.string(),
            status: z.string(),
            error: z.string().nullable()
        }))
    }).optional()
});

export const WorkflowStateSchema = z.object({
    current_version: z.number(),
    status: z.enum(['uploaded', 'requires_ocr', 'ready', 'queued', 'running', 'succeeded', 'failed']),
    steps: z.array(z.object({
        name: z.string(),
        status: z.string(),
        error: z.string().nullable()
    })),
    quality: z.object({
        overall: z.enum(['COMPLETO', 'PARCIAL', 'VACIO']),
        bySection: z.record(z.enum(['COMPLETO', 'PARCIAL', 'VACIO'])),
        missingCriticalFields: z.array(z.string()),
        ambiguous_fields: z.array(z.string()).default([]),
        warnings: z.array(z.string()),
        consistencyWarnings: z.array(z.string()).optional()
    }).optional(),
    evidences: z.array(z.object({
        fieldPath: z.string(),
        quote: z.string(),
        pageHint: z.string().nullable().or(z.string()),
        confidence: z.number(),
    })).optional().default([]),
    updated_at: z.string(),
    created_at: z.string().optional()
});

export type AnalysisVersion = z.infer<typeof AnalysisVersionSchema>;
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

export const LicitacionSchema = LicitacionContentSchema.extend({
    result: LicitacionContentSchema.optional(), // The canonical result (V2)
    versions: z.array(AnalysisVersionSchema).optional(),
    workflow: WorkflowStateSchema.optional(),
    metadata: MetadataSchema.optional(),
    storage: z.object({
        pdf_path: z.string().optional(),
        chunks_path: z.string().optional(),
        text_path: z.string().optional()
    }).optional(),
    notas: z.array(NoteSchema).optional(),
});

export type LicitacionData = z.infer<typeof LicitacionSchema>;
