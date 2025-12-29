/**
 * LLM Provider Abstraction Layer
 * 
 * This module defines the contract for AI/LLM providers (Gemini, OpenAI, etc.)
 * to ensure the application can switch between providers without coupling.
 */

import { LicitacionContent } from '../types';

/**
 * Result of an LLM analysis request for a single section
 */
export interface LLMSectionResult<K extends keyof LicitacionContent> {
    sectionKey: K;
    data: LicitacionContent[K];
    rawResponse?: string; // Optional: keep raw response for debugging
}

/**
 * Progress callback for streaming updates
 */
export type ProgressCallback = (processed: number, total: number, message: string) => void;

/**
 * Options for LLM analysis
 */
export interface LLMAnalysisOptions {
    /** Base64-encoded PDF content */
    base64Content: string;

    /** System prompt (context/instructions) */
    systemPrompt: string;

    /** User prompt for specific section */
    sectionPrompt: string;

    /** Section key being analyzed */
    sectionKey: keyof LicitacionContent;

    /** AbortSignal for cancellation */
    signal?: AbortSignal;

    /** Max retries on transient failures */
    maxRetries?: number;
}

/**
 * Configuration for an LLM provider
 */
export interface LLMProviderConfig {
    /** API key or authentication token */
    apiKey: string;

    /** Optional: model name/version */
    model?: string;

    /** Optional: timeout in milliseconds */
    timeoutMs?: number;

    /** Optional: custom endpoint */
    endpoint?: string;
}

/**
 * Core interface that all LLM providers must implement
 */
export interface LLMProvider {
    /**
     * Unique identifier for this provider
     */
    readonly name: string;

    /**
     * Analyze a section of the PDF and return structured data
     * 
     * @throws {LLMProviderError} on failures
     */
    analyzeSection<K extends keyof LicitacionContent>(
        options: LLMAnalysisOptions
    ): Promise<LLMSectionResult<K>>;

    /**
     * Check if provider is properly configured and ready
     */
    isAvailable(): boolean;

    /**
     * Validate configuration without making API calls
     */
    validateConfig(): { valid: boolean; errors?: string[] };
}

/**
 * Metadata about a provider's capabilities
 */
export interface LLMProviderMetadata {
    name: string;
    displayName: string;
    description: string;
    supportsStreaming: boolean;
    supportsCancellation: boolean;
    requiresConfig: string[]; // List of required config keys
}
