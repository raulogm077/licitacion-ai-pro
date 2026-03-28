import { create } from 'zustand';
import { ProcessingStatus, AnalysisPhase } from '../types';
import { useLicitacionStore } from './licitacion.store';
import { processFile } from '../lib/file-utils';
import { isErr } from '../lib/Result';
import { services } from '../config/service-registry';
import { templateService } from '../services/template.service';
import { MAX_PDF_SIZE_BYTES, MAX_PDF_SIZE_MB } from '../config/constants';
import { logger } from '../services/logger';

interface AnalysisStore {
    status: ProcessingStatus;
    progress: number;
    thinkingOutput: string;
    error: string | null;
    persistenceWarning: string | null;
    abortController: AbortController | null;
    selectedTemplateId: string | null;
    currentPhase: AnalysisPhase | null;

    // Actions
    analyzeFiles: (files: File[]) => Promise<void>;
    cancelAnalysis: () => void;
    resetAnalysis: () => void;
    setTemplateId: (id: string | null) => void;
}

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
    status: 'IDLE',
    progress: 0,
    thinkingOutput: '',
    error: null,
    persistenceWarning: null,
    abortController: null,
    selectedTemplateId: null,
    currentPhase: null,

    analyzeFiles: async (files: File[]) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        const { loadLicitacion, reset: resetLicitacion } = useLicitacionStore.getState();
        const newController = new AbortController();

        resetLicitacion();
        set({
            status: 'READING_PDF',
            progress: 0,
            thinkingOutput: `Iniciando lectura de ${file.name}...`,
            error: null,
            persistenceWarning: null,
            abortController: newController,
            currentPhase: null,
        });

        try {
            // 1. Validation
            if (file.size > MAX_PDF_SIZE_BYTES) {
                throw new Error(
                    `El archivo supera el tamaño máximo permitido de ${MAX_PDF_SIZE_MB}MB. ` +
                        `Tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`
                );
            }

            // 2. File processing
            const { hash, base64, isValidPdf } = await processFile(file);

            if (!isValidPdf) {
                throw new Error('El archivo principal no es un PDF válido.');
            }

            // Process additional files
            const additionalFiles: { name: string; base64: string }[] = [];
            for (let i = 1; i < files.length; i++) {
                const addFile = files[i];
                if (addFile.size > MAX_PDF_SIZE_BYTES) {
                    throw new Error(`El archivo ${addFile.name} supera el límite de tamaño.`);
                }
                const { base64: addBase64, isValidPdf: addIsValid } = await processFile(addFile);
                if (!addIsValid) {
                    throw new Error(`El archivo ${addFile.name} no es un PDF válido.`);
                }
                additionalFiles.push({ name: addFile.name, base64: addBase64 });
            }

            set({
                status: 'ANALYZING',
                progress: 10,
                thinkingOutput: `Archivos verificados. Principal hash: ${hash}\nIniciando pipeline de análisis...`,
            });

            // 3. Template loading
            const { selectedTemplateId } = get();
            let template = null;
            if (selectedTemplateId) {
                const templateResult = await templateService.getTemplate(selectedTemplateId);
                if (templateResult.ok) {
                    template = templateResult.value;
                }
            }

            // 4. Run analysis pipeline
            const { content, workflow } = await services.ai.analyzePdfContent(
                base64,
                (processed, total, message) => {
                    const progressWeight = 80 / total;
                    const currentProgress = 10 + Math.round(processed * progressWeight);

                    set((state) => {
                        const lines = state.thinkingOutput.split('\n');
                        if (lines[lines.length - 1] !== message) {
                            return {
                                thinkingOutput: state.thinkingOutput + '\n' + message,
                                progress: Math.min(currentProgress, 90),
                            };
                        }
                        return { progress: Math.min(currentProgress, 90) };
                    });
                },
                newController.signal,
                file.name,
                hash,
                template,
                additionalFiles.length > 0 ? additionalFiles : undefined
            );

            // 5. Update state & persist
            loadLicitacion(content, hash, workflow);

            set((state) => ({
                status: 'COMPLETED',
                progress: 100,
                thinkingOutput: state.thinkingOutput + '\nAnálisis completado con éxito.',
                currentPhase: null,
            }));

            // Persist to DB
            const saveResult = await services.db.saveLicitacion(hash, file.name, content);
            if (isErr(saveResult)) {
                logger.warn('Fallo en persistencia remota:', saveResult.error);
                set({
                    persistenceWarning: `Advertencia: ${saveResult.error.message}. Los datos no se sincronizaron con la nube.`,
                });
            }
        } catch (error: unknown) {
            logger.error('Critical Analysis Error:', error);
            let errorMessage = 'Error inesperado en el motor de análisis';

            if (error instanceof Error) {
                errorMessage = error.message;

                if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                    errorMessage =
                        'Error de conexión con el servidor de análisis. ' +
                        'Esto puede deberse a un problema de red o a que este dominio no está autorizado (CORS). ' +
                        'Intente de nuevo o contacte soporte si el problema persiste.';
                }

                if (error.message.includes('Tiempo de espera agotado')) {
                    errorMessage =
                        'El servidor no respondió a tiempo. ' +
                        'Intente de nuevo con un documento más pequeño o contacte soporte.';
                }
            }

            if (typeof error === 'object' && error !== null) {
                const errObj = error as Record<string, unknown>;
                const context = errObj.context as Record<string, unknown> | undefined;
                if (context?.status) {
                    errorMessage = `Error del Servidor (${context.status}): ${errorMessage}`;
                    try {
                        if (typeof context.json === 'function') {
                            const body = await (context.json as () => Promise<Record<string, unknown>>)();
                            if (typeof body.error === 'string') {
                                errorMessage = body.error;
                            } else if (typeof body.message === 'string') {
                                errorMessage = body.message;
                            }
                        }
                    } catch {
                        /* ignore */
                    }
                }
            }

            if (
                errorMessage.includes('cancelado') ||
                errorMessage.includes('Cancelado') ||
                (error instanceof Error && error.name === 'AbortError')
            ) {
                set({
                    status: 'IDLE',
                    error: null,
                    thinkingOutput: 'Análisis cancelado por el usuario',
                    abortController: null,
                });
            } else {
                set({ status: 'ERROR', error: errorMessage, abortController: null });
            }
        }
    },

    cancelAnalysis: () => {
        const { abortController } = get();
        if (abortController) {
            abortController.abort();
            set({
                status: 'IDLE',
                thinkingOutput: 'Cancelando análisis...',
                abortController: null,
                currentPhase: null,
            });
        }
    },

    resetAnalysis: () => {
        const { abortController } = get();
        if (abortController) {
            abortController.abort();
        }
        set({
            status: 'IDLE',
            progress: 0,
            thinkingOutput: '',
            error: null,
            persistenceWarning: null,
            abortController: null,
            selectedTemplateId: null,
            currentPhase: null,
        });
    },

    setTemplateId: (id: string | null) => {
        set({ selectedTemplateId: id });
    },
}));
