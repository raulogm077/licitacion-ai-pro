import { Note as ZodNote, LicitacionMetadata as ZodMetadata, LicitacionData as ZodData } from './lib/schemas';

export type Note = ZodNote;
export type LicitacionMetadata = ZodMetadata;
export type LicitacionData = ZodData;

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

export interface DbLicitacion {
    hash: string;
    fileName: string;
    timestamp: number;
    data: LicitacionData;
    metadata: LicitacionMetadata & {
        sectionStatus?: Record<string, 'success' | 'failed' | 'processing'>;
    };
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
    promedioCriterios: { subjetivos: number; objetivos: number };
}

export type View = 'HOME' | 'HISTORY' | 'ANALYTICS' | 'SEARCH' | 'PRESENTATION';
