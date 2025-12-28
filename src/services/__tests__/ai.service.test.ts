import { describe, it, expect, vi, beforeEach } from 'vitest';
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
        // Skip delays
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        global.setTimeout = vi.fn((cb) => { cb(); return {} as any; }) as unknown as typeof setTimeout;
        service = new AIService();
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
        const result = await service.analyzePdfContent("base64data", onProgress);

        expect(result).toBeDefined();
        expect(result.datosGenerales.titulo).toBe("Test Licitación");
        expect(mockInvoke).toHaveBeenCalledTimes(6);
        expect(onProgress).toHaveBeenCalled();
        // Should be called multiple times: 1 start, 3 chunk starts (if chunk size 2), 6 section completions
        expect(onProgress.mock.calls.length).toBeGreaterThan(6);
    });

    it('should handle Edge Function errors gracefully', async () => {
        // Simulate error from function
        mockInvoke.mockResolvedValue({
            data: null,
            error: { message: "Internal Server Error" }
        });

        const result = await service.analyzePdfContent("base64data");
        // Should return defaults/empty for failed sections
        expect(result.datosGenerales.titulo).toBe("No detectado");
    });

    it('should clean Markdown code blocks from backend response', async () => {
        const jsonString = JSON.stringify(validData);
        const markdownResponse = "```json\n" + jsonString + "\n```";

        mockInvoke.mockResolvedValue({
            data: { text: markdownResponse },
            error: null
        });

        const result = await service.analyzePdfContent("base64data");
        expect(result.datosGenerales.titulo).toBe("Test Licitación");
    });

    it('should fill default values if Zod validation finds missing fields', async () => {
        // Return valid JSON but with missing fields
        mockInvoke.mockResolvedValue({
            data: { text: JSON.stringify({ titulo: "Solo Titulo" }) },
            error: null
        });

        const result = await service.analyzePdfContent("base64data");
        expect(result.datosGenerales.titulo).toBe("Solo Titulo");
        expect(result.datosGenerales.presupuesto).toBe(0);
    });

    it('should return defaults on empty backend response', async () => {
        mockInvoke.mockResolvedValue({
            data: null,
            error: null
        });

        const result = await service.analyzePdfContent("base64data");
        expect(result.datosGenerales.titulo).toBe("No detectado");
    });

    it('should call onProgress with correct incrementing values', async () => {
        const jsonString = JSON.stringify(validData);
        mockInvoke.mockResolvedValue({
            data: { text: jsonString },
            error: null
        });

        const onProgress = vi.fn();
        await service.analyzePdfContent("base64data", onProgress);

        // First call should be start
        expect(onProgress).toHaveBeenNthCalledWith(1, 0, 6, expect.stringContaining("Iniciando"));

        // Final processed count should reach 6
        const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
        expect(lastCall[0]).toBe(6);
        expect(lastCall[1]).toBe(6);
    });
});
