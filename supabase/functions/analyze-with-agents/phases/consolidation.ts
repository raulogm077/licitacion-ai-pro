/**
 * Fase D: Consolidación
 *
 * Unifica todos los bloques extraídos en el JSON canónico final.
 * Aplica reglas de prelación documental y marca conflictos.
 * NO inventa valores — solo combina lo extraído.
 */
import {
    CanonicalResultSchema,
    DatosGeneralesSchema,
    EconomicoSchema,
    DuracionYProrrogasSchema,
    CriteriosAdjudicacionSchema,
    RequisitosSolvenciaSchema,
    RequisitosTecnicosSchema,
    RestriccionesYRiesgosSchema,
    ModeloServicioSchema,
    AnexosYObservacionesSchema,
} from '../../_shared/schemas/canonical.ts';
import type { CanonicalResult } from '../../_shared/schemas/canonical.ts';
import type { BlockResult } from './block-extraction.ts';

export interface ConsolidationInput {
    blocks: BlockResult[];
    customTemplate?: Record<string, unknown>;
    onProgress?: (msg: string) => void;
}

export interface ConsolidationResult {
    result: CanonicalResult;
    allEvidences: Array<{ fieldPath: string; quote: string; pageHint?: string; confidence?: number }>;
    allWarnings: string[];
    allAmbiguousFields: string[];
}

export function runConsolidation(input: ConsolidationInput): ConsolidationResult {
    const { blocks, customTemplate, onProgress } = input;

    console.log(`[Consolidation] Starting with ${blocks.length} blocks`);
    onProgress?.('Consolidando bloques...');

    // Collect all evidences, warnings, and ambiguous fields from all blocks
    const allEvidences: ConsolidationResult['allEvidences'] = [];
    const allWarnings: string[] = [];
    const allAmbiguousFields: string[] = [];

    // Build the consolidated result object from blocks
    const blockDataMap: Record<string, unknown> = {};
    const receivedBlocks = new Set<string>();

    for (const block of blocks) {
        blockDataMap[block.blockName] = block.data;
        receivedBlocks.add(block.blockName);
        allEvidences.push(...block.evidences);
        allWarnings.push(...block.warnings);
        allAmbiguousFields.push(...block.ambiguous_fields);
    }

    // Warn if critical blocks are missing entirely
    const criticalBlocks = ['datosGenerales', 'economico', 'criteriosAdjudicacion'];
    for (const name of criticalBlocks) {
        if (!receivedBlocks.has(name)) {
            allWarnings.push(`Bloque crítico "${name}" no fue recibido en la extracción`);
        }
    }

    // Assemble the canonical result
    const rawResult = {
        plantilla_personalizada: customTemplate,
        datosGenerales: blockDataMap['datosGenerales'] || {},
        economico: blockDataMap['economico'] || {},
        duracionYProrrogas: blockDataMap['duracionYProrrogas'] || {},
        criteriosAdjudicacion: blockDataMap['criteriosAdjudicacion'] || {},
        requisitosSolvencia: blockDataMap['requisitosSolvencia'] || {},
        requisitosTecnicos: blockDataMap['requisitosTecnicos'] || {},
        restriccionesYRiesgos: blockDataMap['restriccionesYRiesgos'] || {},
        modeloServicio: blockDataMap['modeloServicio'] || {},
        anexosYObservaciones: blockDataMap['anexosYObservaciones'] || {},
    };

    // Validate against canonical schema (lenient — use safeParse)
    const validated = CanonicalResultSchema.safeParse(rawResult);
    let result: CanonicalResult;

    if (validated.success) {
        result = validated.data;
    } else {
        console.warn('[Consolidation] Schema validation failed:', validated.error.message);
        allWarnings.push(`Consolidation schema warning: ${validated.error.message.substring(0, 300)}`);

        // Retry by recovering each section independently so one malformed block
        // does not wipe the rest of the analysis.
        const retryResult = CanonicalResultSchema.safeParse(recoverCanonicalResult(rawResult, allWarnings));
        if (retryResult.success) {
            result = retryResult.data;
        } else {
            console.error('[Consolidation] Schema validation failed even after retry:', retryResult.error.message);
            allWarnings.push('Consolidación forzada: el resultado puede estar incompleto');
            result = CanonicalResultSchema.parse(recoverCanonicalResult({}, allWarnings));
        }
    }

    // Cross-block consistency checks
    const consistencyWarnings = checkCrossBlockConsistency(result);
    allWarnings.push(...consistencyWarnings);

    const uniqueAmbiguous = [...new Set(allAmbiguousFields)];

    console.log(
        `[Consolidation] Done: ${allWarnings.length} warnings, ${uniqueAmbiguous.length} ambiguous, ${allEvidences.length} evidences`
    );
    onProgress?.(`Consolidación completada: ${allWarnings.length} warnings, ${uniqueAmbiguous.length} campos ambiguos`);

    return { result, allEvidences, allWarnings, allAmbiguousFields: uniqueAmbiguous };
}

function ensureMinimalDatosGenerales(datos: unknown): unknown {
    const d = (datos && typeof datos === 'object' ? datos : {}) as Record<string, unknown>;
    return {
        ...d,
        titulo: d.titulo ?? { value: '', status: 'no_encontrado' },
        organoContratacion: d.organoContratacion ?? { value: '', status: 'no_encontrado' },
        presupuesto: d.presupuesto ?? { value: 0, status: 'no_encontrado' },
        moneda: d.moneda ?? { value: 'EUR', status: 'derivado_tecnico' },
        plazoEjecucionMeses: d.plazoEjecucionMeses ?? { value: 0, status: 'no_encontrado' },
        cpv: d.cpv ?? { value: [], status: 'no_encontrado' },
    };
}

function recoverSection<T>(
    sectionName: string,
    schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false } },
    input: unknown,
    fallback: unknown,
    warnings: string[]
): T {
    const parsed = schema.safeParse(input);
    if (parsed.success) return parsed.data;

    warnings.push(`Sección ${sectionName} recuperada con fallback por error de schema`);
    const fallbackParsed = schema.safeParse(fallback);
    if (!fallbackParsed.success) {
        throw new Error(`Fallback inválido al recuperar sección ${sectionName}`);
    }
    return fallbackParsed.data;
}

function recoverCanonicalResult(rawResult: Record<string, unknown>, warnings: string[]) {
    return {
        plantilla_personalizada: rawResult.plantilla_personalizada,
        datosGenerales: recoverSection(
            'datosGenerales',
            DatosGeneralesSchema,
            ensureMinimalDatosGenerales(rawResult.datosGenerales),
            ensureMinimalDatosGenerales({}),
            warnings
        ),
        economico: recoverSection('economico', EconomicoSchema, rawResult.economico, {}, warnings),
        duracionYProrrogas: recoverSection(
            'duracionYProrrogas',
            DuracionYProrrogasSchema,
            rawResult.duracionYProrrogas,
            {},
            warnings
        ),
        criteriosAdjudicacion: recoverSection(
            'criteriosAdjudicacion',
            CriteriosAdjudicacionSchema,
            rawResult.criteriosAdjudicacion,
            {},
            warnings
        ),
        requisitosSolvencia: recoverSection(
            'requisitosSolvencia',
            RequisitosSolvenciaSchema,
            rawResult.requisitosSolvencia,
            {},
            warnings
        ),
        requisitosTecnicos: recoverSection(
            'requisitosTecnicos',
            RequisitosTecnicosSchema,
            rawResult.requisitosTecnicos,
            {},
            warnings
        ),
        restriccionesYRiesgos: recoverSection(
            'restriccionesYRiesgos',
            RestriccionesYRiesgosSchema,
            rawResult.restriccionesYRiesgos,
            {},
            warnings
        ),
        modeloServicio: recoverSection(
            'modeloServicio',
            ModeloServicioSchema,
            rawResult.modeloServicio,
            {},
            warnings
        ),
        anexosYObservaciones: recoverSection(
            'anexosYObservaciones',
            AnexosYObservacionesSchema,
            rawResult.anexosYObservaciones,
            {},
            warnings
        ),
    };
}

function checkCrossBlockConsistency(result: CanonicalResult): string[] {
    const warnings: string[] = [];

    // Check presupuesto consistency between datosGenerales and economico
    const presupuestoDG = result.datosGenerales.presupuesto.value ?? 0;
    const presupuestoEco = result.economico?.presupuestoBaseLicitacion;
    if (presupuestoDG > 0 && presupuestoEco && presupuestoEco > 0 && presupuestoDG !== presupuestoEco) {
        warnings.push(
            `Inconsistencia de presupuesto: datosGenerales=${presupuestoDG}, economico.PBL=${presupuestoEco}. Verificar cuál es el correcto.`
        );
    }

    // Check plazo consistency between datosGenerales and duracion
    const plazoDG = result.datosGenerales.plazoEjecucionMeses.value ?? 0;
    const plazoDur = result.duracionYProrrogas?.duracionMeses;
    if (plazoDG > 0 && plazoDur && plazoDur > 0 && plazoDG !== plazoDur) {
        warnings.push(`Inconsistencia de plazo: datosGenerales=${plazoDG} meses, duracion=${plazoDur} meses.`);
    }

    // Check that criterios ponderaciones sum to something reasonable
    const criterios = result.criteriosAdjudicacion;
    if (criterios) {
        const totalPonderacion =
            (criterios.subjetivos || []).reduce((sum, c) => sum + (c.ponderacion || 0), 0) +
            (criterios.objetivos || []).reduce((sum, c) => sum + (c.ponderacion || 0), 0);
        if (totalPonderacion > 0 && totalPonderacion !== 100) {
            warnings.push(`La suma de ponderaciones de criterios es ${totalPonderacion} (esperado: 100). Verificar.`);
        }
    }

    return warnings;
}
