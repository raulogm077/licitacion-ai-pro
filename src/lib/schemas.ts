import { z } from 'zod';

const NoteSchema = z.object({
    id: z.string(),
    requirementIndex: z.number().optional(),
    text: z.string(),
    author: z.string(),
    timestamp: z.number(),
    type: z.enum(['NOTE', 'QUESTION', 'WARNING']),
});

const MetadataSchema = z.object({
    tags: z.array(z.string()).default([]),
    cliente: z.string().optional(),
    importeAdjudicado: z.number().optional(),
    estado: z.enum(['PENDIENTE', 'ADJUDICADA', 'DESCARTADA', 'EN_REVISION']).optional(),
    fechaCreacion: z.number().optional(),
    ultimaModificacion: z.number().optional(),
});

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

export const LicitacionSchema = z.object({
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
        })),
        objetivos: RobustArray(z.object({
            descripcion: RobustString(""),
            ponderacion: RobustNumber(0),
            formula: z.string().optional(),
        })),
    }).default({})),
    requisitosTecnicos: z.preprocess(val => val ?? {}, z.object({
        funcionales: RobustArray(
            z.union([
                z.string().transform(str => ({ requisito: str, obligatorio: true })),
                z.object({
                    requisito: RobustString(""),
                    obligatorio: RobustBoolean(true),
                    referenciaPagina: z.number().optional()
                })
            ])
        ),
        normativa: RobustArray(
            z.union([
                z.string().transform(str => ({ norma: str, descripcion: "" })),
                z.object({
                    norma: RobustString(""),
                    descripcion: z.string().optional()
                })
            ])
        ),
    }).default({})),
    requisitosSolvencia: z.preprocess(val => val ?? {}, z.object({
        economica: z.preprocess(val => val ?? {}, z.object({
            cifraNegocioAnualMinima: RobustNumber(0),
            descripcion: z.string().optional().nullable().transform(val => val ?? undefined)
        }).catch({ cifraNegocioAnualMinima: 0, descripcion: undefined })).default({}),
        tecnica: RobustArray(z.object({
            descripcion: RobustString(""),
            proyectosSimilaresRequeridos: RobustNumber(0),
            importeMinimoProyecto: z.number().optional()
        }))
    }).default({})),
    restriccionesYRiesgos: z.preprocess(val => val ?? {}, z.object({
        killCriteria: RobustArray(z.string()),
        riesgos: RobustArray(z.object({
            descripcion: RobustString(""),
            impacto: RobustEnum(['BAJO', 'MEDIO', 'ALTO', 'CRITICO'] as const, 'MEDIO'),
            probabilidad: RobustEnum(['BAJA', 'MEDIA', 'ALTA'] as const, 'MEDIA').optional(),
            mitigacionSugerida: z.string().optional(),
        })),
        penalizaciones: RobustArray(z.object({
            causa: RobustString(""),
            sancion: RobustString(""),
        })),
    }).default({})),
    modeloServicio: z.preprocess(val => val ?? {}, z.object({
        sla: RobustArray(
            z.union([
                z.string().transform(str => ({ metrica: str, objetivo: "N/A" })),
                z.object({
                    metrica: RobustString(""),
                    objetivo: RobustString("N/A")
                })
            ])
        ),
        equipoMinimo: RobustArray(
            z.union([
                z.string().transform(str => ({ rol: str, experienciaAnios: 0 })),
                z.object({
                    rol: RobustString(""),
                    experienciaAnios: RobustNumber(0),
                    titulacion: z.string().optional()
                })
            ])
        )
    }).default({})),
    metadata: MetadataSchema.optional(),
    notas: z.array(NoteSchema).optional(),
});

export type LicitacionData = z.infer<typeof LicitacionSchema>;
