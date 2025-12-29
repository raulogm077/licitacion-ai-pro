/**
 * OpenAI LLM Provider
 * 
 * Direct integration with OpenAI API using GPT-5 mini model.
 * Supports streaming and cancellation via AbortController.
 */

import OpenAI from 'openai';
import { env } from '../../config/env';
import { OPENAI_MODELS } from '../../config/constants';
import { LicitacionContent } from '../../types';
import { LicitacionContentSchema } from '../../lib/schemas';
import {
    LLMProvider,
    LLMProviderConfig,
    LLMAnalysisOptions,
    LLMSectionResult,
    LLMProviderMetadata
} from '../types';
import { LLMProviderError, LLMErrorCode } from '../errors';

export class OpenAIProvider implements LLMProvider {
    readonly name = 'openai';
    private readonly MAX_RETRIES = 3;
    private client: OpenAI | null = null;

    constructor(private config?: LLMProviderConfig) {
        if (this.isAvailable()) {
            this.client = new OpenAI({
                apiKey: config?.apiKey || env.VITE_OPENAI_API_KEY,
                dangerouslyAllowBrowser: true // Required for client-side usage
            });
        }
    }

    isAvailable(): boolean {
        const apiKey = this.config?.apiKey || env.VITE_OPENAI_API_KEY;
        return !!apiKey;
    }

    validateConfig(): { valid: boolean; errors?: string[] } {
        const errors: string[] = [];

        const apiKey = this.config?.apiKey || env.VITE_OPENAI_API_KEY;
        if (!apiKey) {
            errors.push('VITE_OPENAI_API_KEY is required for OpenAI provider');
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    async analyzeSection<K extends keyof LicitacionContent>(
        options: LLMAnalysisOptions
    ): Promise<LLMSectionResult<K>> {
        if (!this.client) {
            throw new LLMProviderError(
                LLMErrorCode.CONFIG_MISSING_KEY,
                'OpenAI client not initialized. Missing API key.'
            );
        }

        const { base64Content, systemPrompt, sectionPrompt, sectionKey, signal, maxRetries } = options;
        const retries = maxRetries ?? this.MAX_RETRIES;

        let lastError: unknown;

        for (let attempt = 1; attempt <= retries; attempt++) {
            // Check for cancellation
            if (signal?.aborted) {
                throw LLMProviderError.fromCancellation();
            }

            try {
                const model = this.config?.model || OPENAI_MODELS.DEFAULT;
                const fullPrompt = `${sectionPrompt}\n\nResponde únicamente con un objeto JSON válido que siga la estructura para la clave "${sectionKey}".`;

                // Create streaming request
                const stream = await this.client.chat.completions.create({
                    model,
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: fullPrompt
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:application/pdf;base64,${base64Content}`,
                                        detail: 'high'
                                    }
                                }
                            ]
                        }
                    ],
                    response_format: { type: 'json_object' },
                    stream: true,
                    temperature: 0.1, // Low temperature for structured extraction
                }, {
                    signal // Pass AbortSignal for cancellation
                });

                // Accumulate streamed response
                let fullResponse = '';
                for await (const chunk of stream) {
                    // Check for cancellation during streaming
                    if (signal?.aborted) {
                        throw LLMProviderError.fromCancellation();
                    }

                    const content = chunk.choices[0]?.delta?.content || '';
                    fullResponse += content;
                }

                if (!fullResponse) {
                    throw new LLMProviderError(
                        LLMErrorCode.PROCESSING_INVALID_RESPONSE,
                        'Empty response from OpenAI API.'
                    );
                }

                // Parse and validate response
                const parsedData = this.parseAndValidateResponse(fullResponse, sectionKey);

                return {
                    sectionKey: sectionKey as K,
                    data: parsedData as LicitacionContent[K],
                    rawResponse: fullResponse
                };

            } catch (e: unknown) {
                lastError = e;
                const isLastAttempt = attempt === retries;

                // If cancellation, throw immediately
                if (e instanceof LLMProviderError && e.code === LLMErrorCode.CANCELLED) {
                    throw e;
                }

                const err = this.handleOpenAIError(e);

                if (!isLastAttempt && err.isRetriable) {
                    const baseDelay = err.code === LLMErrorCode.API_QUOTA_EXCEEDED ? 20000 : 5000;
                    const delay = Math.pow(2, attempt - 1) * baseDelay;

                    console.warn(`[OpenAIProvider] Intento ${attempt}/${retries} fallido para ${sectionKey}. Reintentando en ${delay}ms...`, err.message);
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

    private handleOpenAIError(error: unknown): LLMProviderError {
        console.error('[OpenAIProvider] Error:', error);

        // Handle AbortError from fetch
        if (error instanceof Error && error.name === 'AbortError') {
            return LLMProviderError.fromCancellation();
        }

        // Handle OpenAI SDK errors
        if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as { status?: number }).status;
            const message = (error as { message?: string }).message || String(error);

            switch (status) {
                case 429:
                    return LLMProviderError.fromRateLimit(message);
                case 401:
                case 403:
                    return new LLMProviderError(
                        LLMErrorCode.API_AUTH_ERROR,
                        `Authentication error: ${message}`,
                        error,
                        false
                    );
                case 402:
                    return LLMProviderError.fromQuotaError(
                        'OpenAI quota exceeded or billing issue',
                        'Check your OpenAI billing dashboard'
                    );
                case 500:
                case 503:
                    return new LLMProviderError(
                        LLMErrorCode.API_SERVER_ERROR,
                        `OpenAI server error: ${message}`,
                        error,
                        true
                    );
                default:
                    return new LLMProviderError(
                        LLMErrorCode.API_NETWORK_ERROR,
                        `OpenAI API error (${status}): ${message}`,
                        error,
                        !!(status && status >= 500) // Retry on 5xx errors
                    );
            }
        }

        // Generic error
        if (error instanceof Error) {
            return new LLMProviderError(
                LLMErrorCode.UNKNOWN,
                error.message,
                error,
                false
            );
        }

        return new LLMProviderError(
            LLMErrorCode.UNKNOWN,
            String(error),
            error,
            false
        );
    }

    private parseAndValidateResponse<K extends keyof LicitacionContent>(
        text: string,
        sectionKey: K
    ): LicitacionContent[K] {
        let parsedJson: unknown;

        try {
            parsedJson = JSON.parse(text);
        } catch (e) {
            // Try to extract JSON from text (in case of markdown wrapper)
            const jsonMatch = text.match(/\{.*\}/s);
            if (jsonMatch?.[0]) {
                try {
                    parsedJson = JSON.parse(jsonMatch[0]);
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
            console.warn(`[OpenAIProvider] Zod validation failed for section ${sectionKey}:`, validationResult.error.errors);
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
                    const nums = String(item.requisito || '').match(/\d+(\.\d+)?/);
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
            name: 'openai',
            displayName: 'OpenAI GPT-5 mini',
            description: 'GPT-5 mini - most economical GPT-5 family model with streaming support',
            supportsStreaming: true,
            supportsCancellation: true,
            requiresConfig: ['VITE_OPENAI_API_KEY']
        };
    }
}
