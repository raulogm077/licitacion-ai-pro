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

            const result = await jobService.analyzeWithAgents(
                base64Content,
                filename,
                template || null,
                (event) => {
                    if (signal?.aborted) {
                        throw new LicitacionAIError('Análisis cancelado durante procesamiento');
                    }

                    if (!onProgress) return;

                    const phase = event.phase || currentPhase;

                    if (event.type === 'phase_started' && event.phase) {
                        currentPhase = event.phase;
                        const phaseRange = PHASE_PROGRESS[event.phase];
                        if (phaseRange) {
                            onProgress(phaseRange.start, 100, (event.message as string) || `Fase: ${event.phase}`);
                        }
                    } else if (event.type === 'phase_completed' && event.phase) {
                        const phaseRange = PHASE_PROGRESS[event.phase];
                        if (phaseRange) {
                            onProgress(phaseRange.end, 100, (event.message as string) || `${event.phase} completada`);
                        }
                    } else if (
                        event.type === 'extraction_progress' &&
                        event.blockIndex !== undefined &&
                        event.totalBlocks
                    ) {
                        const range = PHASE_PROGRESS['extraction'];
                        const blockProgress = (event.blockIndex / event.totalBlocks) * (range.end - range.start);
                        onProgress(
                            Math.round(range.start + blockProgress),
                            100,
                            (event.message as string) || 'Extrayendo...'
                        );
                    } else if (event.type === 'phase_progress') {
                        const phaseRange = PHASE_PROGRESS[phase];
                        if (phaseRange) {
                            const mid = (phaseRange.start + phaseRange.end) / 2;
                            onProgress(Math.round(mid), 100, (event.message as string) || 'Procesando...');
                        }
                    } else if (event.type === 'heartbeat') {
                        // No progress update for heartbeats
                    }
                },
                files,
                signal
            );

            if (onProgress) onProgress(100, 100, 'Resultado validado recibido del servidor');
            return result;
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Error en análisis';
            logger.error('Error en análisis AI:', err);
            throw new LicitacionAIError(errorMessage, err);
        }
    }
}
