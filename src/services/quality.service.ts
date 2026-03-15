import { LicitacionContent, WorkflowState } from "../types";

type QualityReport = NonNullable<WorkflowState['quality']>;

export class QualityService {

    evaluateQuality(content: LicitacionContent, ambiguousFields: string[] = []): QualityReport {
        const warnings: string[] = [];
        const missingCritical: string[] = [];
        const sectionStatus: Record<string, 'COMPLETO' | 'PARCIAL' | 'VACIO'> = {};

        // 1. Datos Generales
        const qGenerales = this.evaluateGenerales(content.datosGenerales, missingCritical);
        sectionStatus['datosGenerales'] = qGenerales;

        // 2. Criterios
        // We consider it partial if lists are empty but title exists?
        const hasSubnetivos = content.criteriosAdjudicacion.subjetivos.length > 0;
        const hasObjetivos = content.criteriosAdjudicacion.objetivos.length > 0;

        if (hasSubnetivos && hasObjetivos) sectionStatus['criteriosAdjudicacion'] = 'COMPLETO';
        else if (hasSubnetivos || hasObjetivos) sectionStatus['criteriosAdjudicacion'] = 'PARCIAL';
        else {
            sectionStatus['criteriosAdjudicacion'] = 'VACIO';
            warnings.push("No se detectaron criterios de adjudicación.");
        }

        // 3. Solvencia
        const solEconomica = content.requisitosSolvencia.economica.cifraNegocioAnualMinima > 0;
        const solTecnica = content.requisitosSolvencia.tecnica.length > 0;
        if (solEconomica && solTecnica) sectionStatus['requisitosSolvencia'] = 'COMPLETO';
        else if (solEconomica || solTecnica) sectionStatus['requisitosSolvencia'] = 'PARCIAL';
        else sectionStatus['requisitosSolvencia'] = 'VACIO';

        // 4. Tecnicos
        const hasTecnicos = content.requisitosTecnicos.funcionales.length > 0;
        const hasNormativa = content.requisitosTecnicos.normativa.length > 0;
        if (hasTecnicos) sectionStatus['requisitosTecnicos'] = hasNormativa ? 'COMPLETO' : 'PARCIAL';
        else sectionStatus['requisitosTecnicos'] = 'VACIO';

        // 5. Semantic Consistency Check (RF-AI-08)
        const consistencyWarnings = this.evaluateConsistency(content);
        warnings.push(...consistencyWarnings);

        // Overall logic
        // If critical fields missing -> VACIO or PARCIAL?
        // Let's say if datosGenerales is VACIO, overall is VACIO.
        let overall: 'COMPLETO' | 'PARCIAL' | 'VACIO' = 'COMPLETO';

        const criticalSections = ['datosGenerales', 'criteriosAdjudicacion', 'requisitosTecnicos'];
        const emptyCritical = criticalSections.filter(k => sectionStatus[k] === 'VACIO');

        if (emptyCritical.length === criticalSections.length) {
            overall = 'VACIO';
        } else if (emptyCritical.length > 0 || missingCritical.length > 0) {
            overall = 'PARCIAL';
        }

        // Check if any section is partial
        if (Object.values(sectionStatus).includes('PARCIAL')) {
            overall = 'PARCIAL';
        }

        // Explicitly downgrade overall quality if there are any ambiguous fields
        if (ambiguousFields.length > 0 && overall === 'COMPLETO') {
            overall = 'PARCIAL';
        }

        return {
            overall: overall,
            bySection: sectionStatus as Record<string, 'COMPLETO' | 'PARCIAL' | 'VACIO'>,
            missingCriticalFields: missingCritical,
            ambiguous_fields: ambiguousFields,
            warnings: warnings, // Standard warnings (e.g. empty lists)
            consistencyWarnings: consistencyWarnings // New semantic warnings
        };
    }

    private evaluateConsistency(content: LicitacionContent): string[] {
        const warnings: string[] = [];
        const { datosGenerales, requisitosSolvencia } = content;

        // 1. Budget Logic
        if (datosGenerales.presupuesto !== undefined) {
            if (datosGenerales.presupuesto <= 0) {
                warnings.push("El presupuesto es 0 o negativo, lo cual es inusual.");
            }
            // Formatting check (simple heuristic)
            if (datosGenerales.moneda && !['EUR', 'USD'].includes(datosGenerales.moneda)) {
                warnings.push(`Moneda '${datosGenerales.moneda}' no es estándar (EUR/USD).`);
            }
        }

        // 2. Timeline Logic
        if (datosGenerales.plazoEjecucionMeses <= 0) {
            warnings.push("Plazo de ejecución es 0 meses.");
        }

        // 3. Solvency vs Budget (Typical rule: Solvency < 1.5 * Budget, or Solvency > 0)
        const solvencyAmount = requisitosSolvencia.economica.cifraNegocioAnualMinima;
        const budget = datosGenerales.presupuesto;

        if (solvencyAmount > 0 && budget > 0) {
            if (solvencyAmount > budget * 2) {
                warnings.push(`La solvencia exigida (${solvencyAmount}) es > 2x el presupuesto (${budget}). Verificar.`);
            }
        }

        // 4. Duplicate Detection in Lists (Simple exact match)
        const checkDuplicates = (list: string[], context: string) => {
            const unique = new Set(list.map(s => s.toLowerCase().trim()));
            if (unique.size !== list.length) {
                warnings.push(`Detectados elementos duplicados en ${context}.`);
            }
        };

        const killCriteriaStrings = content.restriccionesYRiesgos.killCriteria.map(k => typeof k === 'string' ? k : k.criterio);
        checkDuplicates(killCriteriaStrings, "Kill Criteria");

        return warnings;
    }

    private evaluateGenerales(data: LicitacionContent['datosGenerales'], missingLog: string[]): 'COMPLETO' | 'PARCIAL' | 'VACIO' {
        let missing = 0;
        const total = 4; // Titulo, Presupuesto, Plazo, Organo

        if (!data.titulo || data.titulo === 'Sin título' || data.titulo === 'No detectado') {
            missingLog.push('datosGenerales.titulo');
            missing++;
        }
        if (!data.presupuesto || data.presupuesto === 0) {
            missingLog.push('datosGenerales.presupuesto');
            missing++;
        }
        if (!data.plazoEjecucionMeses) {
            // Optional/Warning?
            // missingLog.push('datosGenerales.plazoEjecucionMeses');
        }
        if (!data.organoContratacion || data.organoContratacion === 'Desconocido') {
            missingLog.push('datosGenerales.organoContratacion');
            missing++;
        }

        if (missing === 0) return 'COMPLETO';
        if (missing === total) return 'VACIO'; // Likely impossible due to defaults, but logic stands
        return 'PARCIAL';
    }
}

export const qualityService = new QualityService();
