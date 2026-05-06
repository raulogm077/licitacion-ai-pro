/**
 * Schemas por Bloque de Extracción (Fase C)
 *
 * Cada bloque se extrae de forma independiente con su propio schema.
 * Son subsets del schema canónico, usados para validar la salida
 * de cada llamada individual a Responses API.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { z } from 'npm:zod@3.25.76';
import {
    DatosGeneralesSchema,
    EconomicoSchema,
    DuracionYProrrogasSchema,
    CriteriosAdjudicacionSchema,
    RequisitosSolvenciaSchema,
    RequisitosTecnicosSchema,
    RestriccionesYRiesgosSchema,
    ModeloServicioSchema,
    AnexosYObservacionesSchema,
    EvidenceSchema,
} from './canonical.ts';

/** Metadata de evidencias por bloque */
const BlockEvidencesSchema = z
    .array(
        EvidenceSchema.extend({
            fieldPath: z.string(),
        })
    )
    .default([]);

/** Schema de salida por bloque — envuelve la sección + evidencias */
function BlockOutputSchema<T extends z.ZodTypeAny>(sectionSchema: T) {
    return z.object({
        data: sectionSchema,
        evidences: BlockEvidencesSchema,
        warnings: z.array(z.string()).default([]),
        ambiguous_fields: z.array(z.string()).default([]),
    });
}

// ─── Block Schemas ───────────────────────────────────────────────────────────────────────────────

export const DatosGeneralesBlockSchema = BlockOutputSchema(DatosGeneralesSchema);
export const EconomicoBlockSchema = BlockOutputSchema(EconomicoSchema);
export const DuracionBlockSchema = BlockOutputSchema(DuracionYProrrogasSchema);
export const CriteriosBlockSchema = BlockOutputSchema(CriteriosAdjudicacionSchema);
export const SolvenciaBlockSchema = BlockOutputSchema(RequisitosSolvenciaSchema);
export const TecnicosBlockSchema = BlockOutputSchema(RequisitosTecnicosSchema);
export const RestriccionesBlockSchema = BlockOutputSchema(RestriccionesYRiesgosSchema);
export const ServicioBlockSchema = BlockOutputSchema(ModeloServicioSchema);
export const AnexosBlockSchema = BlockOutputSchema(AnexosYObservacionesSchema);

// ─── Block Names (for iteration) ───────────────────────────────────────────────────────────────────

export const BLOCK_NAMES = [
    'datosGenerales',
    'economico',
    'duracionYProrrogas',
    'criteriosAdjudicacion',
    'requisitosSolvencia',
    'requisitosTecnicos',
    'restriccionesYRiesgos',
    'modeloServicio',
    'anexosYObservaciones',
] as const;

export type BlockName = (typeof BLOCK_NAMES)[number];

/** Map block name → Zod schema for validation */
export const BLOCK_SCHEMAS: Record<BlockName, z.ZodTypeAny> = {
    datosGenerales: DatosGeneralesBlockSchema,
    economico: EconomicoBlockSchema,
    duracionYProrrogas: DuracionBlockSchema,
    criteriosAdjudicacion: CriteriosBlockSchema,
    requisitosSolvencia: SolvenciaBlockSchema,
    requisitosTecnicos: TecnicosBlockSchema,
    restriccionesYRiesgos: RestriccionesBlockSchema,
    modeloServicio: ServicioBlockSchema,
    anexosYObservaciones: AnexosBlockSchema,
};
