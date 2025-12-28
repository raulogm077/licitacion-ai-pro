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

// Helper: Handles null/undefined -> empty array
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RobustArray = <T extends z.ZodTypeAny>(schema: T) =>
    z.preprocess(val => (val === null || val === undefined) ? [] : val, z.array(schema).default([]));

export const LicitacionSchema = z.object({
    datosGenerales: z.preprocess(val => val ?? {}, z.object({
        titulo: RobustString('Sin título'),
        presupuesto: z.preprocess(
            val => (val === null || val === undefined) ? 0 : Number(val),
            z.number().default(0)
        ),
        moneda: RobustString("EUR"),
        plazoEjecucionMeses: z.preprocess(
            val => (val === null || val === undefined) ? 0 : Number(val),
            z.number().default(0)
        ),
        cpv: RobustArray(z.string()),
        organoContratacion: RobustString('Desconocido'),
        fechaLimitePresentacion: z.string().optional(),
    }).default({})),
    criteriosAdjudicacion: z.preprocess(val => val ?? {}, z.object({
        subjetivos: RobustArray(z.object({
            descripcion: z.string(),
            ponderacion: z.number().default(0),
            detalles: z.string().optional(),
        })),
        objetivos: RobustArray(z.object({
            descripcion: z.string(),
            ponderacion: z.number().default(0),
            formula: z.string().optional(),
        })),
    }).default({})),
    requisitosTecnicos: z.preprocess(val => val ?? {}, z.object({
        funcionales: RobustArray(
            z.union([
                z.string().transform(str => ({ requisito: str, obligatorio: true })),
                z.object({
                    requisito: z.string(),
                    obligatorio: z.boolean().default(true),
                    referenciaPagina: z.number().optional()
                })
            ])
        ),
        normativa: RobustArray(
            z.union([
                z.string().transform(str => ({ norma: str, descripcion: "" })),
                z.object({
                    norma: z.string(),
                    descripcion: z.string().optional()
                })
            ])
        ),
    }).default({})),
    requisitosSolvencia: z.preprocess(val => val ?? {}, z.object({
        economica: z.preprocess(val => val ?? {}, z.object({
            cifraNegocioAnualMinima: z.preprocess(
                val => (val === null || val === undefined) ? 0 : Number(val),
                z.number().default(0)
            ),
            descripcion: z.string().optional().nullable().transform(val => val ?? undefined)
        }).catch({ cifraNegocioAnualMinima: 0 })).default({}),
        tecnica: RobustArray(z.object({
            descripcion: z.string(),
            proyectosSimilaresRequeridos: z.number().default(0),
            importeMinimoProyecto: z.number().optional()
        }))
    }).default({})),
    restriccionesYRiesgos: z.preprocess(val => val ?? {}, z.object({
        killCriteria: RobustArray(z.string()),
        riesgos: RobustArray(z.object({
            descripcion: z.string(),
            impacto: z.enum(['BAJO', 'MEDIO', 'ALTO', 'CRITICO']),
            probabilidad: z.enum(['BAJA', 'MEDIA', 'ALTA']).optional(),
            mitigacionSugerida: z.string().optional(),
        })),
        penalizaciones: RobustArray(z.object({
            causa: z.string(),
            sancion: z.string(),
        })),
    }).default({})),
    modeloServicio: z.preprocess(val => val ?? {}, z.object({
        sla: RobustArray(
            z.union([
                z.string().transform(str => ({ metrica: str, objetivo: "N/A" })),
                z.object({
                    metrica: z.string(),
                    objetivo: z.string()
                })
            ])
        ),
        equipoMinimo: RobustArray(
            z.union([
                z.string().transform(str => ({ rol: str, experienciaAnios: 0 })),
                z.object({
                    rol: z.string(),
                    experienciaAnios: z.number().default(0),
                    titulacion: z.string().optional()
                })
            ])
        )
    }).default({})),
    metadata: MetadataSchema.optional(),
    notas: z.array(NoteSchema).optional(),
});

export type LicitacionData = z.infer<typeof LicitacionSchema>;
