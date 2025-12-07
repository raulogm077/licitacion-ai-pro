export interface Note {
    id: string;
    requirementIndex?: number; // If attached to a specific requirement
    text: string;
    author: string;
    timestamp: number;
    type: 'NOTE' | 'QUESTION' | 'WARNING';
}

export interface LicitacionMetadata {
    tags: string[];
    cliente?: string;
    importeAdjudicado?: number;
    estado?: 'PENDIENTE' | 'ADJUDICADA' | 'DESCARTADA' | 'EN_REVISION';
    fechaCreacion?: number;
    ultimaModificacion?: number;
}

export interface LicitacionData {
    datosGenerales: {
        titulo: string;
        presupuesto: number;
        moneda: string;
        plazoEjecucionMeses: number;
        cpv: string[];
        organoContratacion: string;
        fechaLimitePresentacion?: string;
    };
    criteriosAdjudicacion: {
        subjetivos: Array<{
            descripcion: string;
            ponderacion: number; // Porcentaje 0-100
            detalles?: string;
        }>;
        objetivos: Array<{
            descripcion: string;
            ponderacion: number; // Porcentaje 0-100
            formula?: string;
        }>;
    };
    requisitosTecnicos: {
        funcionales: Array<{
            requisito: string;
            obligatorio: boolean;
            referenciaPagina?: number;
        }>;
        normativa: Array<{
            norma: string; // ej: ISO 27001, ENS Media
            descripcion?: string;
        }>;
    };
    requisitosSolvencia: {
        economica: {
            cifraNegocioAnualMinima: number;
            descripcion?: string;
        };
        tecnica: Array<{
            descripcion: string;
            proyectosSimilaresRequeridos: number;
            importeMinimoProyecto?: number;
        }>;
    };
    restriccionesYRiesgos: {
        killCriteria: string[]; // Motivos de exclusión directa
        riesgos: Array<{
            descripcion: string;
            impacto: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
            probabilidad?: 'BAJA' | 'MEDIA' | 'ALTA';
            mitigacionSugerida?: string;
        }>;
        penalizaciones: Array<{
            causa: string;
            sancion: string;
        }>;
    };
    modeloServicio: {
        sla: Array<{
            metrica: string;
            objetivo: string;
        }>;
        equipoMinimo: Array<{
            rol: string;
            experienciaAnios: number;
            titulacion?: string;
        }>;
    };
    metadata?: LicitacionMetadata;
    notas?: Note[];
}

export type ProcessingStatus = 'IDLE' | 'READING_PDF' | 'ANALYZING' | 'COMPLETED' | 'ERROR';

export interface AnalysisState {
    status: ProcessingStatus;
    progress: number; // 0-100
    thinkingOutput: string; // Stream de pensamiento
    data: LicitacionData | null;
    error: string | null;
    fileName?: string;
    hash?: string; // For edit persistence
}

export interface SearchFilters {
    tags?: string[];
    cliente?: string;
    presupuestoMin?: number;
    presupuestoMax?: number;
    fechaDesde?: number;
    fechaHasta?: number;
    estado?: LicitacionMetadata['estado'];
}

export interface AnalyticsData {
    totalLicitaciones: number;
    presupuestoTotal: number;
    presupuestoPromedio: number;
    importeAdjudicadoTotal: number;
    tiempoAnalisisPromedio: number;
    distribucionEstados: Record<string, number>;
    distribucionRiesgos: Record<string, number>;
    topClientes: Array<{ cliente: string; count: number; total: number }>;
    topTags: Array<{ tag: string; count: number }>;
}

export type View = 'HOME' | 'HISTORY' | 'ANALYTICS' | 'SEARCH' | 'PRESENTATION';
