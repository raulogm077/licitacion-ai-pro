import { LicitacionContent, ExtractionTemplate } from '../types';
import { logger } from './logger';

export class LicitacionAIError extends Error {
    constructor(
        message: string,
        public readonly originalError?: unknown
    ) {
        super(message);
        this.name = 'LicitacionAIError';
    }
}

/** Progress weights per pipeline phase */
const PHASE_PROGRESS: Record<string, { start: number; end: number }> = {
    ingestion: { start: 0, end: 10 },
    document_map: { start: 10, end: 20 },
    extraction: { start: 20, end: 80 },
    consolidation: { start: 80, end: 90 },
    validation: { start: 90, end: 100 },
};

const formatRetryReason = (reason?: string): string => {
    switch (reason) {
        case 'rate_limit':
            return 'límite temporal de OpenAI';
        case 'server_error':
            return 'error temporal del servidor';
        case 'network':
            return 'problema transitorio de red';
        default:
            return 'error transitorio';
    }
};

const shouldEmitRetryCountdown = (secondsLeft: number): boolean => {
    if (secondsLeft <= 10) return true;
    if (secondsLeft <= 30) return secondsLeft % 5 === 0;
    return secondsLeft % 10 === 0;
};

const getProgressForEvent = (phase: string, blockIndex?: number, totalBlocks?: number): number => {
    const phaseRange = PHASE_PROGRESS[phase];
    if (!phaseRange) return 50;

    if (phase === 'extraction' && blockIndex !== undefined && totalBlocks) {
        const blockProgress = (blockIndex / totalBlocks) * (phaseRange.end - phaseRange.start);
        return Math.round(phaseRange.start + blockProgress);
    }

    return Math.round((phaseRange.start + phaseRange.end) / 2);
};

const buildRetryMessage = (
    blockName: string | undefined,
    attempt: number | undefined,
    maxAttempts: number | undefined,
    secondsLeft: number,
    reason?: string
): string =>
    `Reintentando ${blockName || 'bloque'} en ${secondsLeft}s (${attempt || 1}/${maxAttempts || 1}, ${formatRetryReason(
        reason
    )}).`;

export class AIService {
    async analyzePdfContent(
        base64Content: string,
        onProgress?: (processed: number, total: number, message: string) => void,
        signal?: AbortSignal,
        filename?: string,
        hash?: string,
        template?: ExtractionTemplate | null,
        files?: { name: string; base64: string }[]
    ): Promise<{ content: LicitacionContent; workflow: unknown }> {
        try {
            if (!filename || !hash) {
                throw new LicitacionAIError('Filename and Hash are required for analysis');
            }

            const { jobService } = await import('./job.service');

            if (onProgress) onProgress(0, 100, 'Iniciando análisis por fases...');

            if (signal?.aborted) {
                throw new LicitacionAIError('Análisis cancelado por el usuario');
            }

            let currentPhase = '';
            let retryCountdownTimer: ReturnType<typeof setInterval> | null = null;

            const clearRetryCountdown = () => {
                if (retryCountdownTimer) {
                    clearInterval(retryCountdownTimer);
                    retryCountdownTimer = null;
                }
            };

            const emitProgress = (processed: number, message: string) => {
                if (!onProgress) return;
                onProgress(processed, 100, message);
            };

            try {
                const result = await jobService.analyzeWithAgents(
                    base64Content,
                    filename,
                    template || null,
                    (event) => {
                        if (signal?.aborted) {
                            throw new LicitacionAIError('Análisis cancelado durante procesamiento');
                        }

                        if (!onProgress) return;

                        const phase = ('phase' in event ? event.phase : undefined) || currentPhase;

                        if (event.type !== 'retry_scheduled' && event.type !== 'heartbeat') {
                            clearRetryCountdown();
                        }

                        if (event.type === 'phase_started' && event.phase) {
                            currentPhase = event.phase;
                            const phaseRange = PHASE_PROGRESS[event.phase];
                            if (phaseRange) {
                                emitProgress(phaseRange.start, (event.message as string) || `Fase: ${event.phase}`);
                            }
                        } else if (event.type === 'phase_completed' && event.phase) {
                            const phaseRange = PHASE_PROGRESS[event.phase];
                            if (phaseRange) {
                                emitProgress(phaseRange.end, (event.message as string) || `${event.phase} completada`);
                            }
                        } else if (
                            event.type === 'extraction_progress' &&
                            event.blockIndex !== undefined &&
                            event.totalBlocks
                        ) {
                            emitProgress(
                                getProgressForEvent('extraction', event.blockIndex, event.totalBlocks),
                                (event.message as string) || 'Extrayendo...'
                            );
                        } else if (event.type === 'phase_progress') {
                            emitProgress(getProgressForEvent(phase), (event.message as string) || 'Procesando...');
                        } else if (event.type === 'retry_scheduled') {
                            const progress = getProgressForEvent(
                                phase || 'extraction',
                                event.blockIndex,
                                event.totalBlocks
                            );
                            let secondsLeft = Math.max(1, Math.ceil((event.waitMs || 1000) / 1000));

                            const emitCountdown = () => {
                                if (shouldEmitRetryCountdown(secondsLeft)) {
                                    emitProgress(
                                        progress,
                                        buildRetryMessage(
                                            event.blockName,
                                            event.attempt,
                                            event.maxAttempts,
                                            secondsLeft,
                                            event.reason
                                        )
                                    );
                                }
                            };

                            emitCountdown();
                            retryCountdownTimer = setInterval(() => {
                                secondsLeft -= 1;
                                if (secondsLeft <= 0) {
                                    clearRetryCountdown();
                                    return;
                                }
                                emitCountdown();
                            }, 1000);
                        } else if (event.type === 'heartbeat') {
                            // No progress update for heartbeats
                        }
                    },
                    files,
                    signal
                );

                if (onProgress) onProgress(100, 100, 'Resultado validado recibido del servidor');
                return result;
            } finally {
                clearRetryCountdown();
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Error en análisis';
            logger.error('Error en análisis AI:', err);
            throw new LicitacionAIError(errorMessage, err);
        }
    }
}
