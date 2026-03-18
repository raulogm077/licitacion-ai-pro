/**
 * LLM Provider Factory
 * 
 * Central registry and factory for LLM providers.
 * Supports dynamic provider selection based on configuration or user preference.
 */

import { LLMProvider, LLMProviderMetadata } from './types';
import { OpenAIProvider } from './providers/openai';
import { LLM_PROVIDERS } from '../config/constants';

type ProviderType = typeof LLM_PROVIDERS[keyof typeof LLM_PROVIDERS];

class LLMFactory {
    private providers: Map<string, LLMProvider> = new Map();
    private metadata: Map<string, LLMProviderMetadata> = new Map();

    constructor() {
        // Register default providers
        this.registerProvider('openai', new OpenAIProvider());
        this.registerMetadata('openai', OpenAIProvider.getMetadata());
    }

    /**
     * Register a new provider
     */
    registerProvider(name: string, provider: LLMProvider): void {
        this.providers.set(name, provider);
    }

    /**
     * Register provider metadata
     */
    registerMetadata(name: string, metadata: LLMProviderMetadata): void {
        this.metadata.set(name, metadata);
    }

    /**
     * Get a provider by name
     */
    getProvider(name: ProviderType = LLM_PROVIDERS.OPENAI): LLMProvider {
        const provider = this.providers.get(name);

        if (!provider) {
            throw new Error(`LLM Provider "${name}" not found. Available: ${Array.from(this.providers.keys()).join(', ')}`);
        }

        return provider;
    }

    /**
     * Get default provider (OpenAI)
     */
    getDefaultProvider(): LLMProvider {
        return this.getProvider(LLM_PROVIDERS.OPENAI);
    }

    /**
     * List all available providers
     */
    listProviders(): string[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Get metadata for a provider
     */
    getMetadata(name: string): LLMProviderMetadata | undefined {
        return this.metadata.get(name);
    }

    /**
     * Check if a provider is available (configured and ready)
     */
    isProviderAvailable(name: string): boolean {
        const provider = this.providers.get(name);
        return provider?.isAvailable() ?? false;
    }
}

// Singleton instance
export const llmFactory = new LLMFactory();
