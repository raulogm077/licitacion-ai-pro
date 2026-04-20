export const ANALYSIS_PHASES = ['ingestion', 'document_map', 'extraction', 'consolidation', 'validation'] as const;

export type AnalysisPhase = (typeof ANALYSIS_PHASES)[number];

export const ANALYSIS_PARTIAL_REASONS = [
    'document_insufficient',
    'ocr_or_indexing_low_signal',
    'missing_administrative_content',
    'missing_technical_content',
    'rate_limited_recovered',
    'rate_limited_degraded',
] as const;

export type AnalysisPartialReason = (typeof ANALYSIS_PARTIAL_REASONS)[number];

export const TRACKED_FIELD_STATUSES = ['extraido', 'ambiguo', 'no_encontrado', 'derivado_tecnico'] as const;

export type TrackedFieldStatus = (typeof TRACKED_FIELD_STATUSES)[number];

export const ANALYSIS_QUALITY_STATUSES = ['COMPLETO', 'PARCIAL', 'VACIO'] as const;

export type AnalysisQualityStatus = (typeof ANALYSIS_QUALITY_STATUSES)[number];

export const RETRY_REASONS = ['rate_limit', 'server_error', 'network', 'timeout', 'unknown'] as const;

export type AnalysisRetryReason = (typeof RETRY_REASONS)[number];

export interface TrackedEvidenceWire {
    quote: string;
    pageHint?: string;
    confidence?: number;
}

export interface TrackedFieldWire<T> {
    value: T | null;
    evidence?: TrackedEvidenceWire;
    status: TrackedFieldStatus;
    warnings?: string[];
}

export interface WorkflowQualityWire {
    overall: AnalysisQualityStatus;
    bySection: Record<string, AnalysisQualityStatus>;
    missingCriticalFields: string[];
    ambiguous_fields: string[];
    warnings: string[];
    partial_reasons: AnalysisPartialReason[];
    consistencyWarnings?: string[];
}

export interface WorkflowEvidenceWire extends TrackedEvidenceWire {
    fieldPath: string;
}

export interface PhaseRuntimeState {
    status: 'pending' | 'running' | 'completed' | 'failed';
    startedAt?: string;
    completedAt?: string;
    error?: string;
}

export interface HeartbeatEvent {
    type: 'heartbeat';
    timestamp: number;
}

export interface PhaseStartedEvent {
    type: 'phase_started';
    timestamp: number;
    phase: AnalysisPhase;
    message?: string;
}

export interface PhaseCompletedEvent {
    type: 'phase_completed';
    timestamp: number;
    phase: AnalysisPhase;
    message?: string;
}

export interface PhaseProgressEvent {
    type: 'phase_progress';
    timestamp: number;
    phase?: AnalysisPhase;
    message?: string;
    elapsedMs?: number;
    completedFiles?: number;
    inProgressFiles?: number;
    failedFiles?: number;
}

export interface ExtractionProgressEvent {
    type: 'extraction_progress';
    timestamp: number;
    phase?: AnalysisPhase;
    blockIndex?: number;
    totalBlocks?: number;
    message?: string;
}

export interface RetryScheduledEvent {
    type: 'retry_scheduled';
    timestamp: number;
    phase?: AnalysisPhase;
    blockName?: string;
    attempt?: number;
    maxAttempts?: number;
    waitMs?: number;
    reason?: AnalysisRetryReason;
    blockIndex?: number;
    totalBlocks?: number;
}

export interface CompleteEvent {
    type: 'complete';
    timestamp: number;
    result: unknown;
    workflow?: unknown;
}

export interface ErrorEvent {
    type: 'error';
    timestamp: number;
    message?: string;
    phase?: AnalysisPhase;
}

export interface AgentMessageEvent {
    type: 'agent_message';
    timestamp: number;
    message?: string;
    content?: string | unknown;
}

export type AnalysisStreamEvent =
    | HeartbeatEvent
    | PhaseStartedEvent
    | PhaseCompletedEvent
    | PhaseProgressEvent
    | ExtractionProgressEvent
    | RetryScheduledEvent
    | CompleteEvent
    | ErrorEvent
    | AgentMessageEvent;
