import { AIService } from '../services/ai.service';
import { AnalysisChatService } from '../services/analysis-chat.service';
import { DBService } from '../services/db.service';

/**
 * Service Registry Pattern
 * Centralizes service instantiation to allow for easy mocking,
 * configuration, and decoupling from components/hooks.
 */
class ServiceRegistry {
    private static instance: ServiceRegistry;

    private _ai: AIService | null = null;
    private _analysisChat: AnalysisChatService | null = null;
    private _db: DBService | null = null;

    private constructor() {}

    public static getInstance(): ServiceRegistry {
        if (!ServiceRegistry.instance) {
            ServiceRegistry.instance = new ServiceRegistry();
        }
        return ServiceRegistry.instance;
    }

    public get ai(): AIService {
        if (!this._ai) this._ai = new AIService();
        return this._ai;
    }

    public get analysisChat(): AnalysisChatService {
        if (!this._analysisChat) this._analysisChat = new AnalysisChatService();
        return this._analysisChat;
    }

    public get db(): DBService {
        if (!this._db) this._db = new DBService();
        return this._db;
    }
}

export const services = ServiceRegistry.getInstance();
