import { LicitacionContent, WorkflowState } from "../types";

type QualityReport = NonNullable<WorkflowState['quality']>;

export class QualityService {

    evaluateQuality(content: LicitacionContent): QualityReport {
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

        return {
            overall,
            bySection: sectionStatus as Record<string, 'COMPLETO' | 'PARCIAL' | 'VACIO'>, // Cast to match stricter enum keys if needed
            missingCriticalFields: missingCritical,
            warnings
        };
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
