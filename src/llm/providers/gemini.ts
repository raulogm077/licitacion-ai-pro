/**
 * Gemini LLM Provider (via Supabase Edge Function)
 * 
 * This provider wraps the existing Supabase Edge Function that calls Gemini.
 * It maintains backward compatibility with the current implementation.
 */

import { supabase } from '../../config/supabase';
import { env } from '../../config/env';
import { LicitacionContent } from '../../types';
import { LicitacionContentSchema } from '../../lib/schemas';
import {
    LLMProvider,
    LLMAnalysisOptions,
    LLMSectionResult,
    LLMProviderMetadata
} from '../types';
import { LLMProviderError, LLMErrorCode } from '../errors';

export class GeminiProvider implements LLMProvider {
    readonly name = 'gemini';
    private readonly MAX_RETRIES = 3;

    constructor() { }

    isAvailable(): boolean {
        // Gemini is available if we have Supabase configured (Edge Function handles it)
        return !!env.VITE_SUPABASE_URL && !!env.VITE_SUPABASE_ANON_KEY;
    }

    validateConfig(): { valid: boolean; errors?: string[] } {
        const errors: string[] = [];

        if (!env.VITE_SUPABASE_URL) {
            errors.push('VITE_SUPABASE_URL is required for Gemini provider');
        }

        if (!env.VITE_SUPABASE_ANON_KEY) {
            errors.push('VITE_SUPABASE_ANON_KEY is required for Gemini provider');
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    async analyzeSection<K extends keyof LicitacionContent>(
        options: LLMAnalysisOptions
    ): Promise<LLMSectionResult<K>> {
        const { base64Content, systemPrompt, sectionPrompt, sectionKey, signal, maxRetries } = options;
        const retries = maxRetries ?? this.MAX_RETRIES;

        let lastError: unknown;

        for (let attempt = 1; attempt <= retries; attempt++) {
            // Check for cancellation
            if (signal?.aborted) {
                throw LLMProviderError.fromCancellation();
            }

            try {
                const fullPrompt = `${sectionPrompt}\\n\\nResponde únicamente con un objeto JSON válido que siga la estructura para la clave "${sectionKey}".`;

                const { data, error } = await supabase.functions.invoke('analyze-licitacion', {
                    body: {
                        base64Content,
                        prompt: fullPrompt,
                        systemPrompt,
                        sectionKey
                    },
                    headers: {
                        Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`
                    }
                });

                if (error) {
                    this.handleEdgeFunctionError(error);
                }

                if (!data || !data.text) {
                    throw new LLMProviderError(
                        LLMErrorCode.PROCESSING_INVALID_RESPONSE,
                        'Respuesta de Edge Function vacía.'
                    );
                }

                // Parse and validate response
                const parsedData = this.parseAndValidateResponse(data.text, sectionKey);

                return {
                    sectionKey: sectionKey as K,
                    data: parsedData as LicitacionContent[K],
                    rawResponse: data.text
                };

            } catch (e: unknown) {
                lastError = e;
                const isLastAttempt = attempt === retries;
                const err = e instanceof LLMProviderError ? e : new LLMProviderError(
                    LLMErrorCode.UNKNOWN,
                    e instanceof Error ? e.message : String(e),
                    e
                );

                if (!isLastAttempt && err.isRetriable) {
                    const baseDelay = err.code === LLMErrorCode.API_QUOTA_EXCEEDED ? 20000 : 5000;
                    const delay = Math.pow(2, attempt - 1) * baseDelay;

                    console.warn(`[GeminiProvider] Intento ${attempt}/${retries} fallido para ${sectionKey}. Reintentando en ${delay}ms...`, err.message);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw err;
                }
            }
        }

        const finalError = lastError instanceof LLMProviderError
            ? lastError
            : new LLMProviderError(
                LLMErrorCode.UNKNOWN,
                `Fallo persistente tras ${retries} intentos`,
                lastError
            );
        throw finalError;
    }

    private handleEdgeFunctionError(error: unknown): never {
        console.error('[GeminiProvider] Raw Edge Function Error:', error);

        let errorMessage = (error as Record<string, unknown>)?.message as string || String(error);
        let isQuota = false;
        let hint = '';

        try {
            const parsedError = typeof error === 'string' ? JSON.parse(error) : error;

            if (parsedError && typeof parsedError === 'object') {
                if ('error' in parsedError && typeof parsedError.error === 'string') {
                    errorMessage = parsedError.error;
                }
                if ('isQuota' in parsedError) isQuota = !!parsedError.isQuota;
                if ('hint' in parsedError && typeof parsedError.hint === 'string') hint = parsedError.hint;
            }
        } catch {
            // Ignore parse errors
        }

        if (isQuota || errorMessage.includes('429') || errorMessage.includes('Quota')) {
            throw LLMProviderError.fromQuotaError(errorMessage, hint);
        }

        if (errorMessage.includes('429')) {
            throw LLMProviderError.fromRateLimit(errorMessage);
        }

        throw new LLMProviderError(
            LLMErrorCode.API_SERVER_ERROR,
            `Edge Function Error: ${errorMessage}`,
            error,
            true // Most server errors are retriable
        );
    }

    private parseAndValidateResponse<K extends keyof LicitacionContent>(
        text: string,
        sectionKey: K
    ): LicitacionContent[K] {
        // Clean up markdown code blocks
        let cleanedText = text;
        cleanedText = cleanedText.replace(/```json\n([\s\S]*?)\n```/s, '$1');
        cleanedText = cleanedText.replace(/```([\s\S]*?)```/s, '$1');

        let parsedJson: unknown;

        try {
            parsedJson = JSON.parse(cleanedText);
        } catch (e) {
            // Try to extract JSON from text
            const likelyJson = cleanedText.match(/\\{.*\\}/s);
            if (likelyJson?.[0]) {
                try {
                    parsedJson = JSON.parse(likelyJson[0]);
                } catch {
                    throw LLMProviderError.fromParseError(
                        `Fallo de parseo JSON en sección ${sectionKey}`,
                        e
                    );
                }
            } else {
                throw LLMProviderError.fromParseError(
                    `No se encontró JSON válido en la respuesta para ${sectionKey}`,
                    e
                );
            }
        }

        // Auto-unwrap if AI returned { "sectionKey": { ... } }
        if (parsedJson && typeof parsedJson === 'object' && (parsedJson as Record<string, unknown>)[sectionKey]) {
            parsedJson = (parsedJson as Record<string, unknown>)[sectionKey];
        }

        // Auto-bucket arrays for specific sections (legacy compatibility)
        parsedJson = this.autoBucketArrays(parsedJson, sectionKey);

        // Validate with Zod
        const schema = LicitacionContentSchema.shape[sectionKey as keyof typeof LicitacionContentSchema.shape];
        if (!schema) {
            throw new LLMProviderError(
                LLMErrorCode.PROCESSING_VALIDATION_ERROR,
                `Schema not found for section: ${sectionKey}`
            );
        }

        const validationResult = schema.safeParse(parsedJson);

        if (!validationResult.success) {
            console.warn(`[GeminiProvider] Zod validation failed for section ${sectionKey}:`, validationResult.error.errors);
            throw new LLMProviderError(
                LLMErrorCode.PROCESSING_VALIDATION_ERROR,
                `Validación fallida para ${sectionKey}`,
                validationResult.error
            );
        }

        return validationResult.data as LicitacionContent[K];
    }

    private autoBucketArrays<K extends keyof LicitacionContent>(
        parsedJson: unknown,
        sectionKey: K
    ): unknown {
        if (!Array.isArray(parsedJson)) return parsedJson;

        // Legacy logic for bucketing arrays into proper structure
        if (sectionKey === 'restriccionesYRiesgos') {
            const items = parsedJson as Record<string, unknown>[];
            const newObj: { killCriteria: unknown[], riesgos: unknown[], penalizaciones: unknown[] } = { killCriteria: [], riesgos: [], penalizaciones: [] };
            items.forEach(item => {
                const t = String(item.tipo || '').toLowerCase();
                if (t.includes('kill')) newObj.killCriteria.push(item);
                else if (t.includes('riesgo')) newObj.riesgos.push(item);
                else if (t.includes('penaliz')) newObj.penalizaciones.push(item);
            });
            return newObj;
        }

        if (sectionKey === 'criteriosAdjudicacion') {
            const items = parsedJson as Record<string, unknown>[];
            const newObj: { subjetivos: unknown[], objetivos: unknown[] } = { subjetivos: [], objetivos: [] };
            items.forEach(item => {
                const t = String(item.tipo || '').toLowerCase();
                if (t.includes('subjetivo') || t.includes('juicio')) newObj.subjetivos.push(item);
                else newObj.objetivos.push(item);
            });
            return newObj;
        }

        if (sectionKey === 'requisitosSolvencia') {
            const items = parsedJson as Record<string, unknown>[];
            const newObj: { economica: { cifraNegocioAnualMinima: number }, tecnica: unknown[] } = { economica: { cifraNegocioAnualMinima: 0 }, tecnica: [] };
            items.forEach(item => {
                const t = String(item.tipo || '').toLowerCase();
                if (t.includes('economica')) {
                    const nums = String(item.requisito || '').match(/\\d+(\\.\\d+)?/);
                    if (nums) newObj.economica.cifraNegocioAnualMinima = parseFloat(nums[0]);
                } else {
                    newObj.tecnica.push(item.requisito || item.descripcion);
                }
            });
            return newObj;
        }

        return parsedJson;
    }

    static getMetadata(): LLMProviderMetadata {
        return {
            name: 'gemini',
            displayName: 'Google Gemini',
            description: 'Modelo Gemini vía Supabase Edge Function',
            supportsStreaming: false,
            supportsCancellation: true,
            requiresConfig: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
        };
    }
}
