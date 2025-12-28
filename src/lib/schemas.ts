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

export const LicitacionSchema = z.object({
    datosGenerales: z.preprocess(val => val ?? {}, z.object({
        titulo: z.string().default('Sin título'),
        presupuesto: z.preprocess(
            val => (val === null || val === undefined) ? 0 : Number(val),
            z.number().default(0)
        ),
        moneda: z.string().default("EUR"),
        plazoEjecucionMeses: z.preprocess(
            val => (val === null || val === undefined) ? 0 : Number(val),
            z.number().default(0)
        ),
        cpv: z.array(z.string()).default([]),
        organoContratacion: z.string().default('Desconocido'),
        fechaLimitePresentacion: z.string().optional(),
    }).default({})),
    criteriosAdjudicacion: z.preprocess(val => val ?? {}, z.object({
        subjetivos: z.array(z.object({
            descripcion: z.string(),
            ponderacion: z.number().default(0),
            detalles: z.string().optional(),
        })).default([]),
        objetivos: z.array(z.object({
            descripcion: z.string(),
            ponderacion: z.number().default(0),
            formula: z.string().optional(),
        })).default([]),
    }).default({})),
    requisitosTecnicos: z.preprocess(val => val ?? {}, z.object({
        funcionales: z.array(
            z.union([
                z.string().transform(str => ({ requisito: str, obligatorio: true })),
                z.object({
                    requisito: z.string(),
                    obligatorio: z.boolean().default(true),
                    referenciaPagina: z.number().optional()
                })
            ])
        ).default([]),
        normativa: z.array(
            z.union([
                z.string().transform(str => ({ norma: str, descripcion: "" })),
                z.object({
                    norma: z.string(),
                    descripcion: z.string().optional()
                })
            ])
        ).default([]),
    }).default({})),
    requisitosSolvencia: z.preprocess(val => val ?? {}, z.object({
        economica: z.preprocess(val => val ?? {}, z.object({
            cifraNegocioAnualMinima: z.preprocess(
                val => (val === null || val === undefined) ? 0 : Number(val),
                z.number().default(0)
            ),
            descripcion: z.string().optional().nullable().transform(val => val ?? undefined)
        }).catch({ cifraNegocioAnualMinima: 0 })).default({}),
        tecnica: z.array(z.object({
            descripcion: z.string(),
            proyectosSimilaresRequeridos: z.number().default(0),
            importeMinimoProyecto: z.number().optional()
        })).default([])
    }).default({})),
    restriccionesYRiesgos: z.preprocess(val => val ?? {}, z.object({
        killCriteria: z.array(z.string()).default([]),
        riesgos: z.array(z.object({
            descripcion: z.string(),
            impacto: z.enum(['BAJO', 'MEDIO', 'ALTO', 'CRITICO']),
            probabilidad: z.enum(['BAJA', 'MEDIA', 'ALTA']).optional(),
            mitigacionSugerida: z.string().optional(),
        })).default([]),
        penalizaciones: z.array(z.object({
            causa: z.string(),
            sancion: z.string(),
        })).default([]),
    }).default({})),
    modeloServicio: z.preprocess(val => val ?? {}, z.object({
        sla: z.array(
            z.union([
                z.string().transform(str => ({ metrica: str, objetivo: "N/A" })),
                z.object({
                    metrica: z.string(),
                    objetivo: z.string()
                })
            ])
        ).default([]),
        equipoMinimo: z.array(
            z.union([
                z.string().transform(str => ({ rol: str, experienciaAnios: 0 })),
                z.object({
                    rol: z.string(),
                    experienciaAnios: z.number().default(0),
                    titulacion: z.string().optional()
                })
            ])
        ).default([])
    }).default({})),
    metadata: MetadataSchema.optional(),
    notas: z.array(NoteSchema).optional(),
});

export type LicitacionData = z.infer<typeof LicitacionSchema>;
