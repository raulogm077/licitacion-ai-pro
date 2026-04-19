import { describe, it, expect, vi } from 'vitest';

const constructorSpies = vi.hoisted(() => ({
    ai: vi.fn(),
    analysisChat: vi.fn(),
    db: vi.fn(),
}));

vi.mock('../../services/ai.service', () => ({
    AIService: class MockAIService {
        constructor() {
            constructorSpies.ai();
        }
    },
}));

vi.mock('../../services/analysis-chat.service', () => ({
    AnalysisChatService: class MockAnalysisChatService {
        constructor() {
            constructorSpies.analysisChat();
        }
    },
}));

vi.mock('../../services/db.service', () => ({
    DBService: class MockDBService {
        constructor() {
            constructorSpies.db();
        }
    },
}));

describe('service registry', () => {
    it('creates services lazily and memoizes each instance', async () => {
        const { services } = await import('../service-registry');

        const ai = services.ai;
        const sameAi = services.ai;
        const analysisChat = services.analysisChat;
        const sameAnalysisChat = services.analysisChat;
        const db = services.db;
        const sameDb = services.db;

        expect(ai).toBe(sameAi);
        expect(analysisChat).toBe(sameAnalysisChat);
        expect(db).toBe(sameDb);

        expect(constructorSpies.ai).toHaveBeenCalledTimes(1);
        expect(constructorSpies.analysisChat).toHaveBeenCalledTimes(1);
        expect(constructorSpies.db).toHaveBeenCalledTimes(1);
    });

    it('exports a singleton registry instance', async () => {
        const firstImport = await import('../service-registry');
        const secondImport = await import('../service-registry');

        expect(firstImport.services).toBe(secondImport.services);
    });
});
