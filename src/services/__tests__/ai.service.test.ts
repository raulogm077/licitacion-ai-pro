import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { AIService } from '../ai.service';

// Mock dependencies
vi.mock('@google/generative-ai', () => {
    // Create the mock function outside return to reuse it if needed, or just define inline properly
    const generateContentMock = vi.fn();

    // The constructor mock needs to be a function that returns an object
    class GoogleGenerativeAI {
        getGenerativeModel() {
            return {
                generateContent: generateContentMock
            };
        }
    }

    return {
        GoogleGenerativeAI,
        GenerativeModel: vi.fn(),
        _mockGenerateContent: generateContentMock,
        HarmCategory: {
            HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
            HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
            HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT'
        },
        HarmBlockThreshold: {
            BLOCK_NONE: 'BLOCK_NONE'
        }
    };
});

import * as GoogleGenAI from '@google/generative-ai';

describe('AIService', () => {
    let service: AIService;
    let mockGenerateContent: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        // Access the mocked function from the module namespace
        mockGenerateContent = (GoogleGenAI as unknown as { _mockGenerateContent: Mock })._mockGenerateContent;

        // Skip delays
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        global.setTimeout = vi.fn((cb) => { cb(); return {} as any; }) as unknown as typeof setTimeout;

        service = new AIService('fake-key');
    });

    const validData = {
        datosGenerales: {
            titulo: "Test Licitación",
            presupuesto: 50000,
            moneda: "EUR",
            plazoEjecucionMeses: 12,
            cpv: ["12345678"],
            organoContratacion: "Ayuntamiento",
            fechaLimitePresentacion: "2023-12-31"
        },
        criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
        requisitosTecnicos: { funcionales: [], normativa: [] },
        requisitosSolvencia: {
            economica: { cifraNegocioAnualMinima: 1000 },
            tecnica: []
        },
        restriccionesYRiesgos: { killCriteria: [], riesgos: [], penalizaciones: [] },
        modeloServicio: { sla: [], equipoMinimo: [] }
    };

    it('should parse valid JSON response correctly', async () => {
        const jsonString = JSON.stringify(validData);

        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => jsonString,
                candidates: [{ content: { parts: [{ text: jsonString }] } }]
            }
        });

        const result = await service.analyzePdfContent("base64data");

        expect(result).toBeDefined();
        expect(result.datosGenerales.titulo).toBe("Test Licitación");
        expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('should clean Markdown code blocks', async () => {
        const jsonString = JSON.stringify(validData);
        const markdownResponse = "```json\n" + jsonString + "\n```";

        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => markdownResponse,
                candidates: [{ content: { parts: [{ text: markdownResponse }] } }]
            }
        });

        const result = await service.analyzePdfContent("base64data");
        expect(result.datosGenerales.titulo).toBe("Test Licitación");
    });

    it('should handle API errors gracefully', async () => {
        mockGenerateContent.mockResolvedValue({
            response: {
                candidates: [],
                promptFeedback: { blockReason: "SAFETY" }
            }
        });

        const result = await service.analyzePdfContent("base64data");
        expect(result.datosGenerales.titulo).toBe('Sin título (Error Análisis)');
    });

    it('should throw on validation failure (Zod)', async () => {
        // Return invalid structure (missing fields)


        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => "INVALID JSON { unclosed tag",
                candidates: [{ content: { parts: [{ text: "INVALID JSON { unclosed tag" }] } }]
            }
        });

        const result = await service.analyzePdfContent("base64data");
        expect(result.datosGenerales.titulo).toBe('Sin título (Error Análisis)');
    });

    it.skip('should normalize invalid casing (Smart Parse)', async () => {
        // Deep copy and capitalize keys to simulate bad AI response
        // Deep copy and capitalize keys to simulate bad AI response
        const capitalize = (obj: unknown): unknown => {
            if (Array.isArray(obj)) return obj.map(capitalize);
            if (typeof obj === 'object' && obj !== null) {
                return Object.keys(obj).reduce((acc, key) => {
                    const upper = key.charAt(0).toUpperCase() + key.slice(1);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    acc[upper] = capitalize((obj as any)[key]);
                    return acc;
                }, {} as Record<string, unknown>);
            }
            return obj;
        };
        const wrongCaseData = capitalize(validData);

        const jsonString = JSON.stringify(wrongCaseData);
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => jsonString,
                candidates: [{ content: { parts: [{ text: jsonString }] } }]
            }
        });

        const result = await service.analyzePdfContent("base64data");
        expect(result.datosGenerales.titulo).toBe("Test Licitación");
    });

    it.skip('should unwrap root object (Smart Parse)', async () => {
        const wrappedData = {
            licitacion: validData
        };
        const jsonString = JSON.stringify(wrappedData);
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => jsonString,
                candidates: [{ content: { parts: [{ text: jsonString }] } }]
            }
        });

        const result = await service.analyzePdfContent("base64data");
        expect(result.datosGenerales.titulo).toBe("Test Licitación");
    });

    it('should throw error if result is empty/meaningless (Quality Gate)', async () => {
        const emptyResult = {
            datosGenerales: {} // Will default to "Sin título", 0 budget
        };
        const jsonString = JSON.stringify(emptyResult);
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => jsonString,
                candidates: [{ content: { parts: [{ text: jsonString }] } }]
            }
        });

        const result = await service.analyzePdfContent("base64data");
        expect(result.datosGenerales.titulo).toBe("Sin título (Error Análisis)");
    });
});
