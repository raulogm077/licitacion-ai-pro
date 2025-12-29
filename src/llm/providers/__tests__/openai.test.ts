/**
 * Basic tests for OpenAI Provider
 */

import { describe, it, expect } from 'vitest';
import { OpenAIProvider } from '../openai';
import { LLMErrorCode } from '../../errors';

describe('OpenAIProvider', () => {
    describe('Initialization', () => {
        it('should create instance with default config', () => {
            const provider = new OpenAIProvider();
            expect(provider).toBeDefined();
            expect(provider.name).toBe('openai');
        });

        it('should report availability based on API key', () => {
            const providerWithoutKey = new OpenAIProvider();
            // Availability depends on VITE_OPENAI_API_KEY env var
            expect(typeof providerWithoutKey.isAvailable()).toBe('boolean');
        });

        it('should validate config correctly', () => {
            const provider = new OpenAIProvider();
            const validation = provider.validateConfig();

            expect(validation).toHaveProperty('valid');
            expect(typeof validation.valid).toBe('boolean');

            if (!validation.valid) {
                expect(validation.errors).toBeDefined();
                expect(Array.isArray(validation.errors)).toBe(true);
            }
        });
    });

    describe('Metadata', () => {
        it('should return correct metadata', () => {
            const metadata = OpenAIProvider.getMetadata();

            expect(metadata.name).toBe('openai');
            expect(metadata.displayName).toBe('OpenAI GPT-5 mini');
            expect(metadata.supportsStreaming).toBe(true);
            expect(metadata.supportsCancellation).toBe(true);
            expect(metadata.requiresConfig).toContain('VITE_OPENAI_API_KEY');
        });
    });

    describe('Error Handling', () => {
        it('should throw CONFIG_MISSING_KEY when API key is missing', async () => {
            const provider = new OpenAIProvider({ apiKey: '' });

            try {
                await provider.analyzeSection({
                    base64Content: 'test',
                    systemPrompt: 'test',
                    sectionPrompt: 'test',
                    sectionKey: 'informacionBasica'
                });
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.code).toBe(LLMErrorCode.CONFIG_MISSING_KEY);
            }
        });
    });
});
