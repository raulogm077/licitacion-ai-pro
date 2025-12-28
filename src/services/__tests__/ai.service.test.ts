import { describe, it, expect, vi, beforeEach } from 'vitest';
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
        _mockGenerateContent: generateContentMock
    };
});

import * as GoogleGenAI from '@google/generative-ai';

describe('AIService', () => {
    let service: AIService;
    let mockGenerateContent: any;

    beforeEach(() => {
        vi.clearAllMocks();
        // Access the mocked function from the module namespace
        mockGenerateContent = (GoogleGenAI as any)._mockGenerateContent;

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
                text: () => jsonString
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
                text: () => markdownResponse
            }
        });

        const result = await service.analyzePdfContent("base64data");
        expect(result.datosGenerales.titulo).toBe("Test Licitación");
    });

    it('should handle API errors gracefully', async () => {
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => { throw new Error("Safety Block"); }
            }
        });

        await expect(service.analyzePdfContent("base64data"))
            .rejects.toThrow(/El modelo bloqueó/);
    });

    it('should throw on validation failure (Zod)', async () => {
        // Return invalid structure (missing fields)


        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => "INVALID JSON { unclosed tag"
            }
        });

        await expect(service.analyzePdfContent("base64data"))
            .rejects.toThrow();
    });
});
