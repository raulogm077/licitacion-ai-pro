/**
 * Fase D: Consolidación
 *
 * Unifica todos los bloques extraídos en el JSON canónico final.
 * Aplica reglas de prelación documental y marca conflictos.
 * NO inventa valores — solo combina lo extraído.
 */
import { CanonicalResultSchema } from '../../_shared/schemas/canonical.ts';
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

    onProgress?.('Consolidando bloques...');

    // Collect all evidences, warnings, and ambiguous fields from all blocks
    const allEvidences: ConsolidationResult['allEvidences'] = [];
    const allWarnings: string[] = [];
    const allAmbiguousFields: string[] = [];

    // Build the consolidated result object from blocks
    const blockDataMap: Record<string, unknown> = {};

    for (const block of blocks) {
        blockDataMap[block.blockName] = block.data;
        allEvidences.push(...block.evidences);
        allWarnings.push(...block.warnings);
        allAmbiguousFields.push(...block.ambiguous_fields);
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
    const result: CanonicalResult = validated.success
        ? validated.data
        : (CanonicalResultSchema.parse({
              ...rawResult,
              datosGenerales: ensureMinimalDatosGenerales(rawResult.datosGenerales),
          }) as CanonicalResult);

    if (!validated.success) {
        allWarnings.push(`Consolidation schema warning: ${validated.error.message.substring(0, 300)}`);
    }

    // Cross-block consistency checks
    const consistencyWarnings = checkCrossBlockConsistency(result);
    allWarnings.push(...consistencyWarnings);

    onProgress?.(
        `Consolidación completada: ${allWarnings.length} warnings, ${allAmbiguousFields.length} campos ambiguos`
    );

    return { result, allEvidences, allWarnings, allAmbiguousFields };
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

function checkCrossBlockConsistency(result: CanonicalResult): string[] {
    const warnings: string[] = [];

    // Check presupuesto consistency between datosGenerales and economico
    const presupuestoDG = result.datosGenerales.presupuesto.value;
    const presupuestoEco = result.economico?.presupuestoBaseLicitacion;
    if (presupuestoDG > 0 && presupuestoEco && presupuestoEco > 0 && presupuestoDG !== presupuestoEco) {
        warnings.push(
            `Inconsistencia de presupuesto: datosGenerales=${presupuestoDG}, economico.PBL=${presupuestoEco}. Verificar cuál es el correcto.`
        );
    }

    // Check plazo consistency between datosGenerales and duracion
    const plazoDG = result.datosGenerales.plazoEjecucionMeses.value;
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
