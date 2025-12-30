/**
 * OpenAI LLM Provider
 * 
 * @deprecated Client-side OpenAI integration has been deprecated for security.
 * All OpenAI processing now happens server-side via /api/pliegos/analyze.
 * This class is kept for backward compatibility but will return unavailable.
 */

import { LicitacionContent } from '../../types';
import {
    LLMProvider,
    LLMSectionResult,
    LLMProviderMetadata
} from '../types';
import { LLMProviderError, LLMErrorCode } from '../errors';

export class OpenAIProvider implements LLMProvider {
    readonly name = 'openai';

    constructor() {
        console.warn('[OpenAIProvider] Client-side OpenAI usage is deprecated. Use server-side API instead.');
    }

    isAvailable(): boolean {
        // OpenAI is server-side only, so we assume it is available if the app is deployed
        return true;
    }

    validateConfig(): { valid: boolean; errors?: string[] } {
        return {
            valid: true
        };
    }

    async analyzeSection<K extends keyof LicitacionContent>(): Promise<LLMSectionResult<K>> {
        throw new LLMProviderError(
            LLMErrorCode.CONFIG_MISSING_KEY,
            'OpenAI provider is deprecated for client-side use. Please use the server-side API endpoint /api/pliegos/analyze instead.'
        );
    }

    static getMetadata(): LLMProviderMetadata {
        return {
            name: 'openai',
            displayName: 'OpenAI (Server-side)',
            description: 'GPT-5 mini via secure server API - client-side deprecated',
            supportsStreaming: true,
            supportsCancellation: true,
            requiresConfig: ['OPENAI_API_KEY (server-side)']
        };
    }
}
