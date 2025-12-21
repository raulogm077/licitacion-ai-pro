import { LicitacionSchema } from './schemas';
import { LicitacionData } from '../types';
import { logger } from './logger';

export class LicitacionAIError extends Error {
    constructor(message: string, public readonly originalError?: unknown) {
        super(message);
        this.name = 'LicitacionAIError';
    }
}

export function cleanAndParseJson(text: string): LicitacionData {
    try {
        let cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

        const firstBrace = cleanText.indexOf('{');
        const lastBrace = cleanText.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
            cleanText = cleanText.substring(firstBrace, lastBrace + 1);
        }

        const parsed = JSON.parse(cleanText);

        return LicitacionSchema.parse(parsed);
    } catch (error) {
        logger.error("Failed to parse or validate JSON:", text, error);
        throw new LicitacionAIError("La respuesta de la IA no es válida según el esquema (Zod Error)", error);
    }
}
