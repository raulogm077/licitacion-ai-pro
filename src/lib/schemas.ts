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
    datosGenerales: z.object({
        titulo: z.string(),
        presupuesto: z.number(),
        moneda: z.string().default('EUR'),
        plazoEjecucionMeses: z.number(),
        cpv: z.array(z.string()),
        organoContratacion: z.string(),
        fechaLimitePresentacion: z.string().optional(),
    }),
    criteriosAdjudicacion: z.object({
        subjetivos: z.array(z.object({
            descripcion: z.string(),
            ponderacion: z.number().min(0).max(100),
            detalles: z.string().optional(),
        })),
        objetivos: z.array(z.object({
            descripcion: z.string(),
            ponderacion: z.number().min(0).max(100),
            formula: z.string().optional(),
        })),
    }),
    requisitosTecnicos: z.object({
        funcionales: z.array(z.object({
            requisito: z.string(),
            obligatorio: z.boolean(),
            referenciaPagina: z.number().optional(),
        })),
        normativa: z.array(z.object({
            norma: z.string(),
            descripcion: z.string().optional(),
        })),
    }),
    requisitosSolvencia: z.object({
        economica: z.object({
            cifraNegocioAnualMinima: z.number(),
            descripcion: z.string().optional(),
        }),
        tecnica: z.array(z.object({
            descripcion: z.string(),
            proyectosSimilaresRequeridos: z.number(),
            importeMinimoProyecto: z.number().optional(),
        })),
    }),
    restriccionesYRiesgos: z.object({
        killCriteria: z.array(z.string()),
        riesgos: z.array(z.object({
            descripcion: z.string(),
            impacto: z.enum(['BAJO', 'MEDIO', 'ALTO', 'CRITICO']),
            probabilidad: z.enum(['BAJA', 'MEDIA', 'ALTA']).optional(),
            mitigacionSugerida: z.string().optional(),
        })),
        penalizaciones: z.array(z.object({
            causa: z.string(),
            sancion: z.string(),
        })),
    }),
    modeloServicio: z.object({
        sla: z.array(z.object({
            metrica: z.string(),
            objetivo: z.string(),
        })),
        equipoMinimo: z.array(z.object({
            rol: z.string(),
            experienciaAnios: z.number(),
            titulacion: z.string().optional(),
        })),
    }),
    metadata: MetadataSchema.optional(),
    notas: z.array(NoteSchema).optional(),
});

export type LicitacionData = z.infer<typeof LicitacionSchema>;
