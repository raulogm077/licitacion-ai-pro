/**
 * Schema del Mapa Documental (Fase B)
 *
 * Identifica la estructura del expediente: qué documentos hay,
 * qué tipo son, y dónde encontrar cada sección de interés.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { z } from 'npm:zod@3.22.4';

export const DocumentTypeEnum = z.enum([
    'PCAP',
    'PPT',
    'CUADRO_CARATULA',
    'ANEXO_ECONOMICO',
    'ANEXO_TECNICO',
    'MEMORIA_JUSTIFICATIVA',
    'DEUC',
    'OTRO',
]);

export const DocumentEntrySchema = z.object({
    tipo: DocumentTypeEnum,
    nombre: z.string().describe('Nombre o identificador del documento'),
    descripcion: z.string().optional().describe('Breve descripción del contenido'),
    contienePresupuesto: z.boolean().default(false),
    contienePlazos: z.boolean().default(false),
    contieneCriterios: z.boolean().default(false),
    contieneSolvencia: z.boolean().default(false),
    contieneRequisitos: z.boolean().default(false),
    contieneRestricciones: z.boolean().default(false),
    contieneModeloServicio: z.boolean().default(false),
});

export const DocumentMapSchema = z.object({
    documentos: z.array(DocumentEntrySchema).default([]),
    lotes: z
        .object({
            hayLotes: z.boolean().default(false),
            numeroLotes: z.number().default(0),
            descripcion: z.string().optional(),
        })
        .default({}),
    tablasClave: z
        .array(
            z.object({
                descripcion: z.string(),
                seccion: z.string().optional(),
            })
        )
        .default([]),
    observaciones: z.array(z.string()).default([]),
});

export type DocumentMap = z.infer<typeof DocumentMapSchema>;
export type DocumentEntry = z.infer<typeof DocumentEntrySchema>;
