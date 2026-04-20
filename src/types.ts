import {
    Note as ZodNote,
    LicitacionMetadata as ZodMetadata,
    LicitacionData as ZodData,
    LicitacionContent as ZodContent,
    WorkflowState as ZodWorkflow,
    AnalysisVersion as ZodVersion,
    ExtractionTemplate as ZodExtractionTemplate,
    TemplateField as ZodTemplateField,
    Evidence as ZodEvidence,
    FieldStatus as ZodFieldStatus,
} from './lib/schemas';
import type { AnalysisPartialReason, AnalysisPhase, AnalysisStreamEvent } from './shared/analysis-contract';

export type Note = ZodNote;
export type LicitacionMetadata = ZodMetadata;
export type LicitacionData = ZodData;
export type LicitacionContent = ZodContent;
export type WorkflowState = ZodWorkflow;
export type AnalysisVersion = ZodVersion;
export type Evidence = ZodEvidence;
export type FieldStatus = ZodFieldStatus;
export type { AnalysisPartialReason, AnalysisPhase, AnalysisStreamEvent };

export type ExtractionTemplate = ZodExtractionTemplate;
export type TemplateField = ZodTemplateField;
export type ProcessingStatus = 'IDLE' | 'READING_PDF' | 'ANALYZING' | 'COMPLETED' | 'ERROR';

export interface AnalysisState {
    status: ProcessingStatus;
    progress: number; // 0-100
    thinkingOutput: string;
    data: LicitacionData | null;
    error: string | null;
    fileName?: string;
    hash?: string;
    currentPhase?: AnalysisPhase | null;
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
