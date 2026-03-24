import { describe, it, expect, vi } from 'vitest';
import { llmFactory } from '../llmFactory';

// Mock the OpenAI provider
vi.mock('../providers/openai', () => ({
    OpenAIProvider: class {
        isAvailable() {
            return true;
        }
        static getMetadata() {
            return { name: 'openai', label: 'OpenAI', icon: 'openai' };
        }
    },
}));

describe('LLMFactory', () => {
    it('lists registered providers', () => {
        const providers = llmFactory.listProviders();
        expect(providers).toContain('openai');
    });

    it('gets default provider', () => {
        const provider = llmFactory.getDefaultProvider();
        expect(provider).toBeTruthy();
    });

    it('gets provider by name', () => {
        const provider = llmFactory.getProvider('openai');
        expect(provider).toBeTruthy();
    });

    it('throws for unknown provider', () => {
        expect(() => llmFactory.getProvider('nonexistent' as 'openai')).toThrow('not found');
    });

    it('gets metadata for provider', () => {
        const metadata = llmFactory.getMetadata('openai');
        expect(metadata).toBeTruthy();
        expect(metadata?.name).toBe('openai');
    });

    it('returns undefined metadata for unknown provider', () => {
        const metadata = llmFactory.getMetadata('nonexistent');
        expect(metadata).toBeUndefined();
    });

    it('checks provider availability', () => {
        expect(llmFactory.isProviderAvailable('openai')).toBe(true);
        expect(llmFactory.isProviderAvailable('nonexistent')).toBe(false);
    });

    it('registers a custom provider', () => {
        const mockProvider = { isAvailable: () => true, analyze: vi.fn() };
        llmFactory.registerProvider(
            'custom',
            mockProvider as unknown as Parameters<typeof llmFactory.registerProvider>[1]
        );

        expect(llmFactory.listProviders()).toContain('custom');
        expect(llmFactory.getProvider('custom' as 'openai')).toBe(mockProvider);
    });

    it('registers custom metadata', () => {
        llmFactory.registerMetadata('custom', { name: 'custom', label: 'Custom', icon: '' } as unknown as Parameters<
            typeof llmFactory.registerMetadata
        >[1]);
        expect(llmFactory.getMetadata('custom')?.name).toBe('custom');
    });
});
