import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIService } from '../ai.service';
import { supabase } from '../../config/supabase';

// Mock Supabase client
vi.mock('../../config/supabase', () => ({
    supabase: {
        functions: {
            invoke: vi.fn()
        }
    }
}));

describe('AIService', () => {
    let service: AIService;
    const mockInvoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        service = new AIService();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const validData = {
        datosGenerales: {
            titulo: "Test Licitación",
            presupuesto: 50000,
            moneda: "EUR",
            plazoEjecucionMeses: 12,
            cpv: ["12345678"],
            organoContratacion: "Ayuntamiento"
        },
        criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
        requisitosTecnicos: { funcionales: [], normativa: [] },
        requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 1000 }, tecnica: [] },
        restriccionesYRiesgos: { killCriteria: [], riesgos: [], penalizaciones: [] },
        modeloServicio: { sla: [], equipoMinimo: [] }
    };

    it('should parse valid JSON response correctly from Edge Function', async () => {
        const jsonString = JSON.stringify(validData);

        mockInvoke.mockResolvedValue({
            data: { text: jsonString },
            error: null
        });

        const onProgress = vi.fn();
        // Since we have rate limit waits, we need to advance timers
        const promise = service.analyzePdfContent("base64data", onProgress);

        // Fast-forward through all potential delays
        await vi.runAllTimersAsync();

        const result = await promise;

        expect(result).toBeDefined();
        expect(result.datosGenerales.titulo).toBe("Test Licitación");
        expect(mockInvoke).toHaveBeenCalledTimes(6);
        expect(onProgress).toHaveBeenCalled();
    });

    it('should handle Edge Function errors gracefully (with retries)', async () => {
        // Simulate error from function
        mockInvoke.mockResolvedValue({
            data: null,
            error: { message: "Internal Server Error" }
        });

        // Run the promise
        const promise = service.analyzePdfContent("base64data");

        // Advance timers to skip retry backoff delays (5s, 10s...)
        // We need to advance enough times for all retries of all sections
        await vi.runAllTimersAsync();

        const result = await promise;

        // Should return defaults/empty for failed sections
        expect(result.datosGenerales.titulo).toBe("No detectado");
        expect(result.datosGenerales.presupuesto).toBe(0);

        // Verify multiple calls were made (retries)
        expect(mockInvoke.mock.calls.length).toBeGreaterThan(6);
    });

    it('should clean Markdown code blocks from backend response', async () => {
        const jsonString = JSON.stringify(validData);
        const markdownResponse = "```json\n" + jsonString + "\n```";

        mockInvoke.mockResolvedValue({
            data: { text: markdownResponse },
            error: null
        });

        const promise = service.analyzePdfContent("base64data");
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.datosGenerales.titulo).toBe("Test Licitación");
    });

    it('should fill default values if Zod validation finds missing fields', async () => {
        // Return valid JSON but with missing fields
        mockInvoke.mockResolvedValue({
            data: { text: JSON.stringify({ titulo: "Solo Titulo" }) },
            error: null
        });

        const promise = service.analyzePdfContent("base64data");
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.datosGenerales.titulo).toBe("Solo Titulo");
        expect(result.datosGenerales.presupuesto).toBe(0);
    });

    it('should return defaults on empty backend response', async () => {
        mockInvoke.mockResolvedValue({
            data: null,
            error: null
        });

        const promise = service.analyzePdfContent("base64data");
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.datosGenerales.titulo).toBe("No detectado");
    });
});
